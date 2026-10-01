import { Injectable, NotFoundException } from '@nestjs/common';
import { RentalRepositoryPort, RentalRecord } from '../ports/rental-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import { RentalStateConflictError, VehicleUnavailableForExtensionError } from '../../domain/rental-errors';
import { AuthorizeExtensionCommand } from './authorize-extension.command';

/**
 * UC-ALQ-006 / BR-ALQ-012 - Autorizacion de Ampliacion de Alquiler.
 * TDD-ALQ-001.md seccion 8 / 9.4.
 * Transiciona Rental de EXTENSION_PENDING a ACTIVE y actualiza expectedEndAt.
 */
@Injectable()
export class AuthorizeExtensionHandler {
  constructor(
    private readonly rentals: RentalRepositoryPort,
    private readonly workContext: WorkContextAuthorizationService,
    private readonly matrixAuth: MatrixAuthorizationService,
    private readonly transactionManager: TransactionManagerPort,
    private readonly auditRepository: AuditEventRepositoryPort,
    private readonly outboxRepository: OutboxEventRepositoryPort,
  ) {}

  async execute(command: AuthorizeExtensionCommand): Promise<RentalRecord> {
    const context = await this.workContext.authorize({
      firebaseUid: command.firebaseUid,
      companyId: command.companyId,
      branchId: command.branchId,
    });

    await this.matrixAuth.assertAllowed(context.organizationId, context.role, 'RENTAL', 'AUTHORIZE_EXTENSION');

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
      throw new RentalStateConflictError('autorizar ampliacion en', existing.status);
    }

    const pendingExtension = await this.rentals.findPendingExtensionByRentalId(existing.id);
    if (!pendingExtension) {
      throw new NotFoundException('No existe una solicitud de ampliacion pendiente para este alquiler.');
    }

    // BR-ALQ-012: la ampliacion solo se autoriza si el vehiculo esta disponible
    // en la ventana extendida (sin otro compromiso de reserva/alquiler).
    const currentEnd = existing.expectedEndAt ?? pendingExtension.requestedAt;
    const hasConflict = await this.rentals.findVehicleCommitmentOverlap(
      existing.vehicleId,
      context.organizationId,
      'RENTAL',
      existing.id,
      currentEnd,
      pendingExtension.requestedEndAt,
    );
    if (hasConflict) {
      throw new VehicleUnavailableForExtensionError();
    }

    return this.transactionManager.run(async (tx) => {
      const current = await this.rentals.findById(command.id, scope, tx);
      if (!current) {
        throw new NotFoundException('Alquiler no encontrado.');
      }
      if (current.status !== 'EXTENSION_PENDING') {
        throw new RentalStateConflictError('autorizar ampliacion en', current.status);
      }

      const currentExtension = await this.rentals.findPendingExtensionByRentalId(current.id, tx);
      if (!currentExtension) {
        throw new NotFoundException('No existe una solicitud de ampliacion pendiente para este alquiler.');
      }

      const updated = await this.rentals.authorizeExtension(
        {
          rentalId: command.id,
          scope,
          expectedVersion: command.expectedVersion,
          extensionId: currentExtension.id,
          paymentId: command.paymentId,
          addendumDocumentRef: command.addendumDocumentRef,
          updatedBy: command.firebaseUid,
        },
        tx,
      );

      await this.auditRepository.recordRentalEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.firebaseUid,
          rentalId: updated.id,
          action: 'EXTENSION_AUTHORIZED',
          changes: {
            extensionId: currentExtension.id,
            newExpectedEndAt: currentExtension.requestedEndAt.toISOString(),
            newStatus: 'ACTIVE',
          },
        },
        tx,
      );

      await this.outboxRepository.publish(
        {
          aggregateType: 'rental',
          aggregateId: updated.id,
          eventType: 'AmpliacionAutorizada.v1',
          payload: {
            rentalId: updated.id,
            extensionId: currentExtension.id,
            newExpectedEndAt: currentExtension.requestedEndAt.toISOString(),
          },
        },
        tx,
      );

      return updated;
    });
  }
}
