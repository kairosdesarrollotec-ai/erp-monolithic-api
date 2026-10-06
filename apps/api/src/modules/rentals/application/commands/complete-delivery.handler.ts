import { Injectable, NotFoundException } from '@nestjs/common';
import { RentalRepositoryPort, RentalRecord } from '../ports/rental-repository.port';
import { RentalEvidenceRepositoryPort } from '../ports/rental-evidence-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import { FleetVehicleRepositoryPort } from '../../../fleet/application/ports/fleet-vehicle-repository.port';
import { ClockPort } from '../../../../common/application/ports/clock.port';
import { RentalStateConflictError, MissingDeliveryEvidenceError } from '../../domain/rental-errors';
import { RentalCreationGuard } from '../services/rental-creation.guard';
import { CompleteDeliveryCommand } from './complete-delivery.command';

export const REQUIRED_DELIVERY_PHOTOS = 35;
export const REQUIRED_DELIVERY_VIDEOS = 3;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * ALQ-09 / BR-INS-003 / BR-INS-004 - Entrega formal del vehículo.
 * TDD-03-alquiler.md seccion 10.2 / 11.4
 * Valida checklist fotográfico y audiovisual completo (35 fotos + 3 videos)
 * contra evidencia REAL persistida en RentalEvidence (ver
 * RequestEvidenceUploadSessionHandler / RecordEvidenceHandler) - ya no
 * contra los contadores que enviaba el cliente en el DTO.
 * Transiciona Rental a ACTIVE y Vehículo a RENTED.
 *
 * Fechas (BR-CON-002, Consulta -> Alquiler directo): un alquiler directo se
 * crea SIN fechas; la entrega fija `startAt = ahora` y, si el alquiler viene
 * de una Consulta, `expectedEndAt = startAt + estimatedDays` de la
 * cotizacion vinculada (sin columna nueva), re-chequeando la disponibilidad
 * del vehiculo para ese periodo. Los alquileres de origen Reserva conservan
 * las fechas acordadas y no se tocan.
 *
 * BR-RES-002 (depósito de reserva → garantía de alquiler): regla confirmada el
 * 03 sep 2026 — el monto de depósito de la reserva debe trasladarse íntegro
 * como garantía del alquiler al convertir. La implementación en
 * CreateRentalFromReservationHandler queda pendiente como deuda técnica
 * documentada (TECH-DEBT-BR-RES-002; no aplica a alquileres directos ni de
 * origen Consulta como este handler).
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
    private readonly evidenceRepository: RentalEvidenceRepositoryPort,
    private readonly creationGuard: RentalCreationGuard,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: CompleteDeliveryCommand): Promise<RentalRecord> {
    const context = await this.workContext.authorize({
      firebaseUid: command.firebaseUid,
      companyId: command.companyId,
      branchId: command.branchId,
    });

    await this.matrixAuth.assertAllowed(context.organizationId, context.roleId, 'RENTAL', 'COMPLETE_DELIVERY', { companyId: context.companyId, branchId: context.branchId });

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

    const evidenceCounts = await this.evidenceRepository.countByType(command.id, scope);
    const missingEvidence: string[] = [];
    if (evidenceCounts.photos < REQUIRED_DELIVERY_PHOTOS) {
      missingEvidence.push(
        `${REQUIRED_DELIVERY_PHOTOS - evidenceCounts.photos} fotos restantes (mínimo ${REQUIRED_DELIVERY_PHOTOS})`,
      );
    }
    if (evidenceCounts.videos < REQUIRED_DELIVERY_VIDEOS) {
      missingEvidence.push(
        `${REQUIRED_DELIVERY_VIDEOS - evidenceCounts.videos} videos restantes (mínimo ${REQUIRED_DELIVERY_VIDEOS})`,
      );
    }
    if (missingEvidence.length > 0) {
      throw new MissingDeliveryEvidenceError(missingEvidence);
    }

    return this.transactionManager.run(async (tx) => {
      const current = await this.rentals.findById(command.id, scope, tx);
      if (!current) {
        throw new NotFoundException('Alquiler no encontrado.');
      }
      if (current.status !== 'PENDING_DELIVERY') {
        throw new RentalStateConflictError('completar entrega en', current.status);
      }

      const deliveredAt = this.clock.now();
      let startAt: Date | undefined;
      let expectedEndAt: Date | undefined;
      if (!current.reservationId) {
        startAt = deliveredAt;
        expectedEndAt = current.expectedEndAt ?? undefined;
        if (current.inquiryId) {
          const inquiry = await this.rentals.findInquiryForRental(current.inquiryId, scope.organizationId, tx);
          const estimatedDays = inquiry?.quotations[0]?.estimatedDays;
          if (estimatedDays && estimatedDays > 0) {
            expectedEndAt = new Date(startAt.getTime() + estimatedDays * MS_PER_DAY);
          }
        }

        const vehicle = await this.rentals.findVehicleById(current.vehicleId, tx);
        if (!vehicle) {
          throw new NotFoundException('Vehículo no encontrado.');
        }
        await this.creationGuard.assertVehicleAvailable(
          vehicle,
          scope.branchId,
          this.creationGuard.resolveWindow({
            startAt,
            expectedEndAt: expectedEndAt && expectedEndAt.getTime() > startAt.getTime() ? expectedEndAt : undefined,
          }),
          tx,
        );
      }

      const updated = await this.rentals.completeDelivery(
        {
          rentalId: command.id,
          scope,
          expectedVersion: command.expectedVersion,
          updatedBy: command.firebaseUid,
          startAt,
          expectedEndAt,
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
            photosCount: evidenceCounts.photos,
            videosCount: evidenceCounts.videos,
            reportedPhotosCount: command.photosCount,
            reportedVideosCount: command.videosCount,
            notes: command.notes,
            newStatus: 'ACTIVE',
            vehicleStatus: 'RENTED',
            startAt: updated.startAt?.toISOString() ?? null,
            expectedEndAt: updated.expectedEndAt?.toISOString() ?? null,
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
            deliveredAt: deliveredAt.toISOString(),
          },
        },
        tx,
      );

      return updated;
    });
  }
}
