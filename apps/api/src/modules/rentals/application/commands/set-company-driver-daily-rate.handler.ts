import { Injectable, NotFoundException } from '@nestjs/common';
import { RentalRecord, RentalRepositoryPort } from '../ports/rental-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import {
  CompanyDriverRateClosedError,
  CompanyDriverRateInvalidError,
  CompanyDriverRateNotApplicableError,
} from '../../domain/rental-errors';
import { computeCompanyDriverCharge, normalizeManualDailyRate } from '../../domain/company-driver-charge';
import { isCompanyDriverVariantCode } from '../../domain/contract-variant';
import { SetCompanyDriverDailyRateCommand } from './set-company-driver-daily-rate.command';

/**
 * Respuestas de Russbel 20-oct-2026 (#2): la tarifa se digita/corrige desde que el contrato esta formalizado (solo
 * entonces se conoce la variante "con conductor de la empresa") y SOLO hasta que termina el proceso de alquiler, es
 * decir hasta completar la entrega (PENDING_DELIVERY -> ACTIVE). La devolucion es otro proceso: desde ACTIVE en
 * adelante -> 409 COMPANY_DRIVER_RATE_CLOSED.
 */
const RATE_EDITABLE_STATUSES: ReadonlySet<string> = new Set(['PENDING_DELIVERY']);

/**
 * DEC-ALQ-DRIVERRATE-001 (F-02; respuestas de Russbel 19/20-oct-2026): la tarifa diaria del conductor de la empresa aun no
 * existe y se digita a mano por alquiler; es OBLIGATORIA para completar la entrega (COMPANY_DRIVER_RATE_REQUIRED). El valor manual tiene prioridad sobre el env
 * `COMPANY_DRIVER_DAILY_RATE`. Solo alquileres con contrato "con conductor de la empresa". El total
 * (tarifa x dias) NO se persiste: se calcula en la respuesta. Permiso: reutiliza RENTAL.FORMALIZE_CONTRACT (ADM-02),
 * igual que register-companion/register-authorized-driver. Auditoria + evento outbox con el valor anterior y el nuevo.
 */
@Injectable()
export class SetCompanyDriverDailyRateHandler {
  constructor(
    private readonly rentals: RentalRepositoryPort,
    private readonly workContext: WorkContextAuthorizationService,
    private readonly matrixAuth: MatrixAuthorizationService,
    private readonly transactionManager: TransactionManagerPort,
    private readonly auditRepository: AuditEventRepositoryPort,
    private readonly outboxRepository: OutboxEventRepositoryPort,
  ) {}

  async execute(command: SetCompanyDriverDailyRateCommand): Promise<RentalRecord> {
    const context = await this.workContext.authorize({
      firebaseUid: command.firebaseUid,
      companyId: command.companyId,
      branchId: command.branchId,
    });
    await this.matrixAuth.assertAllowed(context.organizationId, context.roleId, 'RENTAL', 'FORMALIZE_CONTRACT', {
      companyId: context.companyId,
      branchId: context.branchId,
    });

    const dailyRate = normalizeManualDailyRate(command.dailyRate);
    if (!dailyRate) {
      throw new CompanyDriverRateInvalidError();
    }

    const scope = {
      organizationId: context.organizationId,
      operatingCompanyId: command.companyId,
      branchId: command.branchId,
    };

    return this.transactionManager.run(async (tx) => {
      const rental = await this.rentals.findById(command.id, scope, tx);
      if (!rental) {
        throw new NotFoundException('Alquiler no encontrado.');
      }
      if (['ACTIVE', 'EXTENSION_PENDING', 'RETURN_IN_PROGRESS', 'CLOSED', 'CANCELLED'].includes(rental.status)) {
        throw new CompanyDriverRateClosedError(rental.status);
      }
      if (!isCompanyDriverVariantCode(rental.contract?.contractVariant) || !RATE_EDITABLE_STATUSES.has(rental.status)) {
        throw new CompanyDriverRateNotApplicableError();
      }

      const previousDailyRate = rental.companyDriverDailyRate ?? null;
      const updated = await this.rentals.setCompanyDriverDailyRate(
        {
          rentalId: rental.id,
          scope,
          expectedVersion: command.expectedVersion,
          dailyRate,
          updatedBy: command.firebaseUid,
        },
        tx,
      );

      await this.auditRepository.recordRentalEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.firebaseUid,
          rentalId: rental.id,
          action: 'COMPANY_DRIVER_RATE_SET',
          changes: { previousDailyRate, dailyRate, currency: 'PEN', status: rental.status },
        },
        tx,
      );
      await this.outboxRepository.publish(
        {
          aggregateType: 'rental',
          aggregateId: rental.id,
          eventType: 'TarifaConductorEmpresaDefinida.v1',
          payload: { rentalId: rental.id, previousDailyRate, dailyRate, currency: 'PEN' },
        },
        tx,
      );

      // Misma vista que el GET: el front muestra origen/total sin pedir otro GET.
      const companyDriverCharge = computeCompanyDriverCharge({
        dailyRate: process.env.COMPANY_DRIVER_DAILY_RATE,
        currency: process.env.COMPANY_DRIVER_DAILY_RATE_CURRENCY,
        manualDailyRate: updated.companyDriverDailyRate,
        startAt: updated.startAt,
        expectedEndAt: updated.expectedEndAt,
      });
      return { ...updated, companyDriverCharge };
    });
  }
}
