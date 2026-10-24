import { Injectable } from '@nestjs/common';
import { RentalRepositoryPort } from '../../../rentals/application/ports/rental-repository.port';
import { canTransitionRental } from '../../../rentals/domain/rental-status';
import { FleetVehicleRepositoryPort } from '../../../fleet/application/ports/fleet-vehicle-repository.port';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { ClockPort } from '../../../../common/application/ports/clock.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import { ReturnRecord, ReturnRepositoryPort } from '../ports/return-repository.port';
import { ReturnOpenIncidentsPort } from '../ports/return-open-incidents.port';
import { ReturnVehicleCommitmentPort } from '../ports/return-vehicle-commitment.port';
import { ReturnAccessService } from '../services/return-access.service';
import {
  ActiveIncidentsBlockCloseError,
  MechanicReportNotAcceptedError,
  RentalNotReturnableError,
  ReturnNotFoundError,
  ReturnOfflineChangesPendingError,
  ReturnRentalNotFoundError,
  ReturnStateConflictError,
} from '../../domain/return-errors';
import { appendNotes, findOpenIncidents, openIncidentLabel, resolveVehicleStatusAfterReturn } from '../../domain/return-rules';
import { assertCanTransitionReturn } from '../../domain/return-status';
import { CloseReturnCommand } from './close-return.command';

/**
 * DEV-09 / DEV-10 / DR-DEV-001 - Cierre formal del expediente. Sin incidencias abiertas: devolución CERRADA,
 * alquiler CLOSED y vehículo de flota a AVAILABLE o MAINTENANCE (integración real con Rentals y Fleet).
 * Libera además el compromiso RENTAL del vehículo (DEC-DEV-COMMITMENT-001).
 * La actualización de flota (sin soporte de tx en su puerto) es el último paso dentro de la transacción: si
 * falla, se revierte todo lo anterior.
 */
@Injectable()
export class CloseReturnHandler {
  constructor(
    private readonly access: ReturnAccessService,
    private readonly returns: ReturnRepositoryPort,
    private readonly rentals: RentalRepositoryPort,
    private readonly fleetVehicles: FleetVehicleRepositoryPort,
    private readonly transactionManager: TransactionManagerPort,
    private readonly clock: ClockPort,
    private readonly auditRepository: AuditEventRepositoryPort,
    private readonly outboxRepository: OutboxEventRepositoryPort,
    private readonly openIncidentsPort: ReturnOpenIncidentsPort,
    private readonly vehicleCommitments: ReturnVehicleCommitmentPort,
  ) {}

  async execute(command: CloseReturnCommand): Promise<ReturnRecord> {
    const { context, scope } = await this.access.authorize(command, 'CLOSE');

    if (command.hasPendingOfflineChanges) {
      throw new ReturnOfflineChangesPendingError();
    }

    const existing = await this.returns.findById(command.id, scope);
    if (!existing) {
      throw new ReturnNotFoundError(command.id);
    }
    if (existing.status !== 'CIERRE_FINANCIERO') {
      throw new ReturnStateConflictError('cerrar', existing.status);
    }

    const now = this.clock.now();

    return this.transactionManager.run(async (tx) => {
      const current = await this.returns.findById(command.id, scope, tx);
      if (!current) {
        throw new ReturnNotFoundError(command.id);
      }
      if (current.status !== 'CIERRE_FINANCIERO') {
        throw new ReturnStateConflictError('cerrar', current.status);
      }

      // DR-DEV-001 / NFR-KAI-008: nunca se cierra con una incidencia abierta vinculada.
      const damages = current.damages ?? [];
      // Incluye las incidencias ABIERTAS reales del modulo Incidencias ligadas al alquiler/devolucion (INC-01/INC-02).
      const linkedIncidentIds = await this.openIncidentsPort.findOpenIncidentIds(
        { rentalId: current.rentalId, returnId: current.id, scope },
        tx,
      );
      const openIncidents = [...findOpenIncidents(current.status, damages), ...linkedIncidentIds.map(openIncidentLabel)];
      if (openIncidents.length > 0) {
        throw new ActiveIncidentsBlockCloseError(openIncidents);
      }

      // DEC-DEV-REPORT-001 (Frente C): si registra daños, inmovilización exige que el cliente acepte el informe mecánico antes de cerrar
      const hasDamages = (damages.length > 0);
      if (hasDamages && !current.mechanicReportAccepted) {
        throw new MechanicReportNotAcceptedError();
      }
      assertCanTransitionReturn(current.status, 'CERRADA');

      const rental = await this.rentals.findById(current.rentalId, scope, tx);
      if (!rental) {
        throw new ReturnRentalNotFoundError(current.rentalId);
      }

      const updated = await this.returns.update(
        {
          id: command.id,
          scope,
          expectedVersion: command.expectedVersion,
          status: 'CERRADA',
          closedAt: now,
          notes: appendNotes(current.notes, command.notes),
          updatedBy: command.firebaseUid,
        },
        tx,
      );

      if (rental.status !== 'CLOSED') {
        if (!canTransitionRental(rental.status, 'CLOSED')) {
          throw new RentalNotReturnableError(rental.status);
        }
        await this.rentals.transitionStatus(rental.id, scope, 'CLOSED', rental.version, command.firebaseUid, tx);
      }

      // DEC-DEV-COMMITMENT-001: el compromiso RENTAL del vehículo (vehicle_commitments) deja de bloquear la
      // disponibilidad al cerrar la devolución, aunque el alquiler terminara antes de lo pactado (devolución
      // anticipada). Idempotente: sin compromiso (alquiler directo) libera 0 filas.
      const commitmentsReleased = await this.vehicleCommitments.releaseRentalCommitment(
        updated.rentalId,
        context.organizationId,
        tx,
      );

      const vehicleStatus = resolveVehicleStatusAfterReturn(damages);

      await this.auditRepository.recordRentalEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.firebaseUid,
          rentalId: updated.rentalId,
          action: 'RETURN_CLOSED',
          changes: {
            returnId: updated.id,
            closedAt: now.toISOString(),
            vehicleStatus,
            vehicleCommitmentsReleased: commitmentsReleased,
            signed: !!command.signatureData,
            warrantyActRequested: command.generateWarrantyAct ?? false,
          },
        },
        tx,
      );
      await this.outboxRepository.publish(
        {
          aggregateType: 'return',
          aggregateId: updated.id,
          eventType: 'DevolucionCompletada.v1',
          payload: {
            returnId: updated.id,
            rentalId: updated.rentalId,
            vehicleId: updated.vehicleId,
            customerId: updated.customerId,
            status: updated.status,
            alcoholTestResult: updated.alcoholTestResult,
            vehicleStatus,
            finalSettlementAmount: updated.finalSettlementAmount,
            warrantyActRequested: command.generateWarrantyAct ?? false,
            closedAt: now.toISOString(),
            organizationId: context.organizationId,
            operatingCompanyId: context.companyId,
            branchId: context.branchId,
          },
        },
        tx,
      );

      // Último paso: Fleet no acepta tx, así que cualquier fallo anterior ya revirtió la transacción.
      await this.fleetVehicles.updateStatus(
        updated.vehicleId,
        { organizationId: context.organizationId, operatingCompanyId: context.companyId },
        vehicleStatus,
      );

      return updated;
    });
  }
}
