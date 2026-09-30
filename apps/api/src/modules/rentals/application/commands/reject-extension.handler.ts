import { Injectable, NotFoundException } from '@nestjs/common';
import { RentalRepositoryPort, RentalRecord } from '../ports/rental-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import { RentalStateConflictError } from '../../domain/rental-errors';
import { RejectExtensionCommand } from './reject-extension.command';

/**
 * UC-ALQ-006 / BR-ALQ-012 - Rechazo de Ampliacion de Alquiler.
 * TDD-ALQ-001.md seccion 8 / 9.4.
 * Transiciona Rental de EXTENSION_PENDING de vuelta a ACTIVE, sin extender el plazo.
 *
 * NOTA / TODO: este handler cubre el rechazo "simple" (p.ej. el vehiculo no esta
 * disponible, o la solicitud no procede). El caso de BR-ALQ-013 (incumplimiento
 * grave: el cliente no cumple los 4 requisitos y retiene el vehiculo vencido el
 * plazo) requiere ademas: (1) marcar la extension como BREACH en vez de REJECTED,
 * (2) retener el 100% de la garantia (RentalDepositAdjustment tipo FULL_RETENTION),
 * (3) evaluar/disparar el proceso penal, y (4) marcar al cliente como "rojo" de
 * inmediato. Ese flujo de falta grave NO esta implementado aqui por alcance de
 * tiempo: se deja como TODO explicito para un siguiente ticket (UC-ALQ-006b).
 */
@Injectable()
export class RejectExtensionHandler {
  constructor(
    private readonly rentals: RentalRepositoryPort,
    private readonly workContext: WorkContextAuthorizationService,
    private readonly matrixAuth: MatrixAuthorizationService,
    private readonly transactionManager: TransactionManagerPort,
    private readonly auditRepository: AuditEventRepositoryPort,
    private readonly outboxRepository: OutboxEventRepositoryPort,
  ) {}

  async execute(command: RejectExtensionCommand): Promise<RentalRecord> {
    const context = await this.workContext.authorize({
      firebaseUid: command.firebaseUid,
      companyId: command.companyId,
      branchId: command.branchId,
    });

    await this.matrixAuth.assertAllowed(context.organizationId, context.role, 'RENTAL', 'REJECT_EXTENSION');

    const scope = {
      organizationId: context.organizationId,
      operatingCompanyId: command.companyId,
      branchId: command.branchId,
    };

    const existing = await this.rentals.findById(command.id, scope);
    if (!existing) {
      throw new NotFoundException('Alquiler no encontrado.');
    }
    if (existing.status !== 'EXTENSION_PENDING') {
      throw new RentalStateConflictError('rechazar ampliacion en', existing.status);
    }

    const pendingExtension = await this.rentals.findPendingExtensionByRentalId(existing.id);
    if (!pendingExtension) {
      throw new NotFoundException('No existe una solicitud de ampliacion pendiente para este alquiler.');
    }

    return this.transactionManager.run(async (tx) => {
      const current = await this.rentals.findById(command.id, scope, tx);
      if (!current) {
        throw new NotFoundException('Alquiler no encontrado.');
      }
      if (current.status !== 'EXTENSION_PENDING') {
        throw new RentalStateConflictError('rechazar ampliacion en', current.status);
      }

      const currentExtension = await this.rentals.findPendingExtensionByRentalId(current.id, tx);
      if (!currentExtension) {
        throw new NotFoundException('No existe una solicitud de ampliacion pendiente para este alquiler.');
      }

      const updated = await this.rentals.rejectExtension(
        {
          rentalId: command.id,
          scope,
          expectedVersion: command.expectedVersion,
          extensionId: currentExtension.id,
          updatedBy: command.firebaseUid,
        },
        tx,
      );

      await this.auditRepository.recordRentalEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.firebaseUid,
          rentalId: updated.id,
          action: 'EXTENSION_REJECTED',
          changes: {
            extensionId: currentExtension.id,
            newStatus: 'ACTIVE',
          },
        },
        tx,
      );

      await this.outboxRepository.publish(
        {
          aggregateType: 'rental',
          aggregateId: updated.id,
          eventType: 'AmpliacionRechazada.v1',
          payload: {
            rentalId: updated.id,
            extensionId: currentExtension.id,
          },
        },
        tx,
      );

      return updated;
    });
  }
}
