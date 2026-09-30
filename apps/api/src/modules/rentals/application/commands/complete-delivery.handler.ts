import { Injectable, NotFoundException } from '@nestjs/common';
import { RentalRepositoryPort, RentalRecord } from '../ports/rental-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import { FleetVehicleRepositoryPort } from '../../../fleet/application/ports/fleet-vehicle-repository.port';
import { RentalStateConflictError, MissingDeliveryEvidenceError } from '../../domain/rental-errors';
import { CompleteDeliveryCommand } from './complete-delivery.command';

export const REQUIRED_DELIVERY_PHOTOS = 35;
export const REQUIRED_DELIVERY_VIDEOS = 3;

/**
 * ALQ-09 / BR-INS-003 / BR-INS-004 - Entrega formal del vehículo.
 * TDD-03-alquiler.md seccion 10.2 / 11.4
 * Valida checklist fotográfico y audiovisual completo (35 fotos + 3 videos).
 * Transiciona Rental a ACTIVE y Vehículo a RENTED.
 */
@Injectable()
export class CompleteDeliveryHandler {
  constructor(
    private readonly rentals: RentalRepositoryPort,
    private readonly fleetVehicles: FleetVehicleRepositoryPort,
    private readonly workContext: WorkContextAuthorizationService,
    private readonly matrixAuth: MatrixAuthorizationService,
    private readonly transactionManager: TransactionManagerPort,
    private readonly auditRepository: AuditEventRepositoryPort,
    private readonly outboxRepository: OutboxEventRepositoryPort,
  ) {}

  async execute(command: CompleteDeliveryCommand): Promise<RentalRecord> {
    const missingEvidence: string[] = [];
    if (command.photosCount < REQUIRED_DELIVERY_PHOTOS) {
      missingEvidence.push(`${REQUIRED_DELIVERY_PHOTOS - command.photosCount} fotos restantes (mínimo ${REQUIRED_DELIVERY_PHOTOS})`);
    }
    if (command.videosCount < REQUIRED_DELIVERY_VIDEOS) {
      missingEvidence.push(`${REQUIRED_DELIVERY_VIDEOS - command.videosCount} videos restantes (mínimo ${REQUIRED_DELIVERY_VIDEOS})`);
    }
    if (missingEvidence.length > 0) {
      throw new MissingDeliveryEvidenceError(missingEvidence);
    }

    const context = await this.workContext.authorize({
      firebaseUid: command.firebaseUid,
      companyId: command.companyId,
      branchId: command.branchId,
    });

    await this.matrixAuth.assertAllowed(context.organizationId, context.role, 'RENTAL', 'COMPLETE_DELIVERY');

    const scope = {
      organizationId: context.organizationId,
      operatingCompanyId: command.companyId,
      branchId: command.branchId,
    };

    const existing = await this.rentals.findById(command.id, scope);
    if (!existing) {
      throw new NotFoundException('Alquiler no encontrado.');
    }
    if (existing.status !== 'PENDING_DELIVERY') {
      throw new RentalStateConflictError('completar entrega en', existing.status);
    }

    return this.transactionManager.run(async (tx) => {
      const current = await this.rentals.findById(command.id, scope, tx);
      if (!current) {
        throw new NotFoundException('Alquiler no encontrado.');
      }
      if (current.status !== 'PENDING_DELIVERY') {
        throw new RentalStateConflictError('completar entrega en', current.status);
      }

      const updated = await this.rentals.completeDelivery(
        {
          rentalId: command.id,
          scope,
          expectedVersion: command.expectedVersion,
          updatedBy: command.firebaseUid,
        },
        tx,
      );

      // Actualizar estado del vehículo a RENTED en flota
      await this.fleetVehicles.updateStatus(
        current.vehicleId,
        {
          organizationId: context.organizationId,
          operatingCompanyId: context.companyId,
        },
        'RENTED',
      );

      await this.auditRepository.recordRentalEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.firebaseUid,
          rentalId: updated.id,
          action: 'DELIVERY_COMPLETED',
          changes: {
            photosCount: command.photosCount,
            videosCount: command.videosCount,
            notes: command.notes,
            newStatus: 'ACTIVE',
            vehicleStatus: 'RENTED',
          },
        },
        tx,
      );

      await this.outboxRepository.publish(
        {
          aggregateType: 'rental',
          aggregateId: updated.id,
          eventType: 'EntregaCompletada.v1',
          payload: {
            rentalId: updated.id,
            vehicleId: current.vehicleId,
            customerId: current.customerId,
            deliveredAt: new Date().toISOString(),
          },
        },
        tx,
      );

      return updated;
    });
  }
}
