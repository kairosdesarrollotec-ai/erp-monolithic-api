import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InquiryRepositoryPort, InquiryRecord } from '../ports/inquiry-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { ClockPort } from '../../../../common/application/ports/clock.port';
import { FleetAvailabilityPort } from '../ports/fleet-availability.port';
import { RateCardPort } from '../ports/rate-card.port';
import { assertInquiryRoleAllowed } from '../policies/inquiry-role-policy';
import { ProvisionalQuotingGuard } from '../services/provisional-quoting.guard';
import { InquiryNotTransitionableError, VehicleNotEligibleError } from '../../domain/inquiry-errors';
import { QuoteCommand } from './quote.command';

const MS_PER_HOUR = 60 * 60 * 1000;

/**
 * CON-P07 (BR-CON-005) - crea el snapshot versionado del tarifario
 * (`Quotation`) y transiciona a COTIZADA. Nunca toca `vehicle_commitments`
 * (TDD-CON-001.md 10: exhibicion de solo lectura, sin bloqueo).
 *
 * Revalidacion PR#7 (d7a6124):
 * - ALTO "RBAC pendiente": politica rol-accion `QUOTE`.
 * - ALTO "Fleet/tarifario": elegibilidad via `FleetAvailabilityPort` y
 *   precio via `RateCardPort` (versionado) - ya no una constante importada.
 *   Con adaptadores provisionales, en produccion se rechaza (503) salvo
 *   habilitacion explicita (`ProvisionalQuotingGuard`).
 * - ALTO "aislamiento de vehiculo": la elegibilidad exige que el vehiculo
 *   sea de la misma organizacion Y empresa (ademas, FK compuesta en la base).
 * - `validUntil` se calcula con el reloj inyectable (`ClockPort`).
 */
@Injectable()
export class QuoteHandler {
  constructor(
    private readonly inquiries: InquiryRepositoryPort,
    private readonly workContext: WorkContextAuthorizationService,
    private readonly fleet: FleetAvailabilityPort,
    private readonly rateCards: RateCardPort,
    private readonly quotingGuard: ProvisionalQuotingGuard,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: QuoteCommand): Promise<InquiryRecord> {
    if (!Number.isInteger(command.estimatedDays) || command.estimatedDays <= 0) {
      throw new BadRequestException({
        code: 'INVALID_ESTIMATED_DAYS',
        detail: 'El numero estimado de dias debe ser un entero mayor a cero.',
      });
    }

    const context = await this.workContext.authorize({
      firebaseUid: command.firebaseUid,
      companyId: command.companyId,
      branchId: command.branchId,
    });
    assertInquiryRoleAllowed(context.role, 'QUOTE');
    this.quotingGuard.assertReady();

    const scope = {
      organizationId: context.organizationId,
      operatingCompanyId: context.companyId,
      branchId: context.branchId,
    };

    const existing = await this.inquiries.findById(command.id, scope);
    if (!existing) {
      throw new NotFoundException('Consulta no encontrada.');
    }
    if (existing.status !== 'REGISTRADA' && existing.status !== 'COTIZADA') {
      throw new InquiryNotTransitionableError(existing.status);
    }

    const eligibility = await this.fleet.checkEligibility({
      ...scope,
      vehicleId: command.vehicleId,
      destination: command.destination,
      estimatedDays: command.estimatedDays,
    });
    if (!eligibility.eligible) {
      throw new VehicleNotEligibleError(eligibility.reason);
    }

    const now = this.clock.now();
    const rateCard = await this.rateCards.currentFor(scope.operatingCompanyId, now);
    const amount = (Number(rateCard.amountPerDay) * command.estimatedDays).toFixed(2);
    const validUntil = new Date(now.getTime() + rateCard.validityHours * MS_PER_HOUR);

    return this.inquiries.quote(
      {
        id: command.id,
        ...scope,
        expectedVersion: command.expectedVersion,
        vehicleId: eligibility.vehicleId,
        destination: command.destination,
        estimatedDays: command.estimatedDays,
        amount,
        currency: rateCard.currency,
        rateCardVersionId: rateCard.version,
        validUntil,
      },
      ['REGISTRADA', 'COTIZADA'],
    );
  }
}
