import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InquiryRepositoryPort, InquiryRecord } from '../ports/inquiry-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { ClockPort } from '../../../../common/application/ports/clock.port';
import { FleetAvailabilityPort } from '../ports/fleet-availability.port';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { ProvisionalQuotingGuard } from '../services/provisional-quoting.guard';
import {
  InquiryNotTouristUseError,
  InquiryNotTransitionableError,
  PlanRateNotConfiguredError,
  VehicleNotEligibleError,
  VehicleNotSuitableForTrochaError,
} from '../../domain/inquiry-errors';
import { QuoteCommand } from './quote.command';

const MS_PER_HOUR = 60 * 60 * 1000;

/**
 * Vigencia de la cotizacion. Constante transversal, no un dato de negocio
 * configurable - 72h viene de la decision original de PROP-007 y nunca fue
 * cuestionada por negocio (a diferencia del precio, que si era real por
 * vehiculo - ver fleet-availability.port.ts).
 */
const QUOTE_VALIDITY_HOURS = 72;

/**
 * Marcador del origen del precio en Quotation.rateCardVersionId (columna
 * NOT NULL, sin FK - ver schema.prisma). Ya no identifica una fila de
 * `rate_card_versions` (puerto eliminado, oct 2026): el precio ahora es
 * directo del Vehicle.dailyRate consultado en el mismo checkEligibility,
 * y la propia Quotation (amount/createdAt) ES el snapshot versionado.
 */
const PRICE_SOURCE_MARKER = 'FLEET-DAILY-RATE';

/**
 * CON-P07 (BR-CON-005) - crea el snapshot versionado del tarifario
 * (`Quotation`) y transiciona a COTIZADA. Nunca toca `vehicle_commitments`
 * (TDD-CON-001.md 10: exhibicion de solo lectura, sin bloqueo).
 *
 * Revalidacion PR#7 (d7a6124):
 * - ALTO "RBAC pendiente": politica rol-accion `QUOTE`.
 * - ALTO "Fleet/tarifario": elegibilidad via `FleetAvailabilityPort` - ya
 *   no una constante importada. Con el adaptador provisional, en
 *   produccion se rechaza (503) salvo habilitacion explicita
 *   (`ProvisionalQuotingGuard`).
 * - ALTO "aislamiento de vehiculo": la elegibilidad exige que el vehiculo
 *   sea de la misma organizacion Y empresa (ademas, FK compuesta en la base).
 * - `validUntil` se calcula con el reloj inyectable (`ClockPort`).
 *
 * Correccion (oct 2026, a pedido de Russbel - "para que existe Flota si el
 * precio sale de otro lado"): se elimina la dependencia de `RateCardPort`
 * (`rate_card_versions`, tarifario por empresa). Era una decision tecnica
 * provisional de PROP-007, nunca confirmada contra el negocio real - el
 * tarifario real (`Ficha_AS-IS_VELOXRENT_Alquiler_PARA_NOTION.md` seccion
 * 5.1) siempre fue por vehiculo, igual que TDD-CON-001.md seccion 2.1
 * ("snapshot versionado del tarifario", sin mencionar una tabla aparte por
 * empresa). El precio ahora sale de `Vehicle.dailyRate` (FLO-02), devuelto
 * por la misma consulta de elegibilidad a Flota.
 */
@Injectable()
export class QuoteHandler {
  constructor(
    private readonly inquiries: InquiryRepositoryPort,
    private readonly workContext: WorkContextAuthorizationService,
    private readonly fleet: FleetAvailabilityPort,
    private readonly quotingGuard: ProvisionalQuotingGuard,
    private readonly clock: ClockPort,
    private readonly matrixAuth: MatrixAuthorizationService,
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
    await this.matrixAuth.assertAllowed(context.organizationId, context.roleId, 'INQUIRY', 'QUOTE', { companyId: context.companyId, branchId: context.branchId });
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
    // P-05 (DT-CON-03): sin uso turistico no se cotiza; solo queda cerrar con motivo.
    if (!existing.touristUse) {
      throw new InquiryNotTouristUseError();
    }

    const eligibility = await this.fleet.checkEligibility({
      ...scope,
      vehicleId: command.vehicleId,
      destination: command.destination,
      estimatedDays: command.estimatedDays,
      startsAt: existing.travelStartDate ?? undefined,
    });
    if (!eligibility.eligible) {
      throw new VehicleNotEligibleError(eligibility.reason);
    }

    // DEC-CON-TROCHA-001: Si la consulta indica trocha, el vehiculo debe ser apto para trocha.
    if (existing.isDirtRoad && !eligibility.suitableForTrocha) {
      throw new VehicleNotSuitableForTrochaError();
    }

    const plan = command.plan ?? 'NORMAL';
    let dailyRate: number;
    if (plan === 'PLUS') {
      if (eligibility.ratePlus == null) {
        throw new PlanRateNotConfiguredError('PLUS');
      }
      dailyRate = Number(eligibility.ratePlus);
    } else if (plan === 'LIBRE') {
      if (eligibility.rateLibre == null) {
        throw new PlanRateNotConfiguredError('LIBRE');
      }
      dailyRate = Number(eligibility.rateLibre);
    } else {
      // NORMAL
      const normalRate = eligibility.rateNormal ?? eligibility.dailyRate;
      if (normalRate == null) {
        throw new PlanRateNotConfiguredError('NORMAL');
      }
      dailyRate = Number(normalRate);
    }

    const now = this.clock.now();
    const amount = (dailyRate * command.estimatedDays).toFixed(2);
    const validUntil = new Date(now.getTime() + QUOTE_VALIDITY_HOURS * MS_PER_HOUR);

    return this.inquiries.quote(
      {
        id: command.id,
        ...scope,
        expectedVersion: command.expectedVersion,
        vehicleId: eligibility.vehicleId,
        destination: command.destination,
        estimatedDays: command.estimatedDays,
        amount,
        plan,
        // PEN: moneda unica actual de Flota (Vehicle.dailyRate no tiene
        // columna de moneda - mismo alcance que el resto del dominio, que
        // ya asume soles sin excepcion documentada).
        currency: 'PEN',
        rateCardVersionId: PRICE_SOURCE_MARKER,
        validUntil,
        // P-06: historial append-only.
        interaction: {
          channel: existing.channel,
          outcome: 'COTIZADA',
          note: `Cotizacion ${amount} PEN (${plan}) por ${command.estimatedDays} dia(s), vehiculo ${eligibility.vehicleId}.`,
        },
      },
      ['REGISTRADA', 'COTIZADA'],
    );
  }
}
