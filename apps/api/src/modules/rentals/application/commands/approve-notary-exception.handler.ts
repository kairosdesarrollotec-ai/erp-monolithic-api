import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { RentalRepositoryPort, RentalRecord } from '../ports/rental-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import { RentalStateConflictError, ProhibitedVehicleNotaryExemptionError } from '../../domain/rental-errors';
import { PROHIBITED_NOTARY_EXEMPTION_MODELS } from '../policies/notary-matrix-policy';
import { ApproveNotaryExceptionCommand } from './approve-notary-exception.command';

/**
 * ALQ-05 / BR-ALQ-004 - Aprobación de Excepción Notarial (Tercer Camino).
 * Solo permitido para rol GERENCIA (Fiorella/José según SDD §11.2).
 * Transiciona Rental de NOTARY_EVALUATION a CONTRACTING.
 */
@Injectable()
export class ApproveNotaryExceptionHandler {
  constructor(
    private readonly rentals: RentalRepositoryPort,
    private readonly workContext: WorkContextAuthorizationService,
    private readonly matrixAuth: MatrixAuthorizationService,
    private readonly transactionManager: TransactionManagerPort,
    private readonly auditRepository: AuditEventRepositoryPort,
    private readonly outboxRepository: OutboxEventRepositoryPort,
  ) {}

  async execute(command: ApproveNotaryExceptionCommand): Promise<RentalRecord> {
    if (!command.justification || command.justification.trim().length < 10) {
      throw new BadRequestException({
        code: 'JUSTIFICATION_REQUIRED',
        detail: 'La justificación de la excepción notarial debe tener al menos 10 caracteres explicativos.',
      });
    }

    const context = await this.workContext.authorize({
      firebaseUid: command.firebaseUid,
      companyId: command.companyId,
      branchId: command.branchId,
    });

    await this.matrixAuth.assertAllowed(context.organizationId, context.role, 'RENTAL', 'APPROVE_NOTARY_EXCEPTION');

    const scope = {
      organizationId: context.organizationId,
      operatingCompanyId: command.companyId,
      branchId: command.branchId,
    };

    const existing = await this.rentals.findById(command.id, scope);
    if (!existing) {
      throw new NotFoundException('Alquiler no encontrado.');
    }
    if (existing.status !== 'NOTARY_EVALUATION') {
      throw new RentalStateConflictError('aprobar excepción notarial en', existing.status);
    }

    // Regla BR-ALQ-003: Prohibición absoluta de excepción en modelos de alto riesgo
    const vehicle = await this.rentals.findVehicleById(existing.vehicleId);
    if (vehicle) {
      const normalizedModel = vehicle.model.toUpperCase();
      const isProhibited = PROHIBITED_NOTARY_EXEMPTION_MODELS.some((m) =>
        normalizedModel.includes(m),
      );
      if (isProhibited) {
        throw new ProhibitedVehicleNotaryExemptionError(vehicle.model);
      }
    }

    return this.transactionManager.run(async (tx) => {
      const current = await this.rentals.findById(command.id, scope, tx);
      if (!current) {
        throw new NotFoundException('Alquiler no encontrado.');
      }
      if (current.status !== 'NOTARY_EVALUATION') {
        throw new RentalStateConflictError('aprobar excepción notarial en', current.status);
      }

      const updated = await this.rentals.approveNotaryException(
        {
          id: command.id,
          scope,
          expectedVersion: command.expectedVersion,
          approvedBy: command.firebaseUid,
          justification: command.justification.trim(),
          updatedBy: command.firebaseUid,
        },
        tx,
      );

      await this.auditRepository.recordRentalEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.firebaseUid,
          rentalId: updated.id,
          action: 'NOTARY_EXCEPTION_APPROVED',
          changes: {
            approvedBy: command.firebaseUid,
            justification: command.justification.trim(),
            newStatus: 'CONTRACTING',
          },
        },
        tx,
      );

      await this.outboxRepository.publish(
        {
          aggregateType: 'rental',
          aggregateId: updated.id,
          eventType: 'ExcepcionNotarialAprobada.v1',
          payload: {
            rentalId: updated.id,
            approvedBy: command.firebaseUid,
            justification: command.justification.trim(),
            status: updated.status,
          },
        },
        tx,
      );

      return updated;
    });
  }
}
