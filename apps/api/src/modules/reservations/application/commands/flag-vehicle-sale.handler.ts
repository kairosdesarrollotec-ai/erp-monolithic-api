import { Injectable, NotFoundException } from '@nestjs/common';
import { ReservationRepositoryPort, ReservationRecord } from '../ports/reservation-repository.port';
import { ReservationSaleResolutionRepositoryPort } from '../ports/reservation-sale-resolution-repository.port';
import { SaleAlternativeVehicleGuard } from '../services/sale-alternative-vehicle.guard';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import { ReservationStateConflictError } from '../../domain/reservation-errors';
import { FlagVehicleSaleCommand } from './flag-vehicle-sale.command';

/**
 * UC-RES-004 / BR-RES-007 / EX-RES-001 (RES-P13/P14, RES-07) - Gerencia (o el
 * Administrador) registra que el vehiculo reservado se vendio y, opcionalmente,
 * la alternativa que se ofrece al cliente (fotos/video 360 se comparten fuera
 * del sistema). CONFIRMED -> PENDING_SALE_RESOLUTION.
 *
 * El `vehicle_commitment` SIGUE bloqueando el vehiculo vendido hasta
 * `resolve-sale` (TDD-RES-001.md 11.1: permanece hasta conversion, cancelacion
 * o resolucion excepcional). Solo se admite desde CONFIRMED (TDD 8.2 flag-sale).
 * Mutacion + fila de `reservation_resolutions` + auditoria + outbox en una
 * unica transaccion Serializable; version/estado se controlan con un
 * `updateMany` atomico (412 si la version no coincide). La alternativa
 * ofrecida se valida ahora (disponible en la ventana de la reserva) y se
 * revalida al aceptar.
 */
@Injectable()
export class FlagVehicleSaleHandler {
  constructor(
    private readonly reservations: ReservationRepositoryPort,
    private readonly saleResolutions: ReservationSaleResolutionRepositoryPort,
    private readonly alternativeGuard: SaleAlternativeVehicleGuard,
    private readonly workContext: WorkContextAuthorizationService,
    private readonly matrixAuth: MatrixAuthorizationService,
    private readonly auditRepository: AuditEventRepositoryPort,
    private readonly outboxRepository: OutboxEventRepositoryPort,
    private readonly transactionManager: TransactionManagerPort,
  ) {}

  async execute(command: FlagVehicleSaleCommand): Promise<ReservationRecord> {
    const context = await this.workContext.authorize({
      firebaseUid: command.firebaseUid,
      companyId: command.companyId,
      branchId: command.branchId,
    });
    await this.matrixAuth.assertAllowed(context.organizationId, context.roleId, 'RESERVATION', 'FLAG_SALE', {
      companyId: context.companyId,
      branchId: context.branchId,
    });

    const scope = {
      organizationId: context.organizationId,
      operatingCompanyId: command.companyId,
      branchId: command.branchId,
    };

    const existing = await this.reservations.findById(command.id, scope);
    if (!existing) throw new NotFoundException('Reserva no encontrada.');
    if (existing.status !== 'CONFIRMED') {
      throw new ReservationStateConflictError('registrar la venta del vehiculo de', existing.status);
    }

    return this.transactionManager.run(
      async (tx) => {
        const current = await this.reservations.findById(command.id, scope, tx);
        if (!current) throw new NotFoundException('Reserva no encontrada.');
        if (current.status !== 'CONFIRMED') {
          throw new ReservationStateConflictError('registrar la venta del vehiculo de', current.status);
        }
        if (command.alternativeVehicleId) {
          await this.alternativeGuard.assertUsable(current, command.alternativeVehicleId, tx);
        }

        const flagged = await this.saleResolutions.flagSale(
          {
            ...scope,
            id: command.id,
            expectedVersion: command.expectedVersion,
            flaggedBy: command.firebaseUid,
            offeredVehicleId: command.alternativeVehicleId,
            note: command.note,
          },
          tx,
        );

        await this.auditRepository.recordReservationEvent(
          {
            organizationId: context.organizationId,
            actorUserId: command.firebaseUid,
            reservationId: flagged.id,
            action: 'RESERVATION_VEHICLE_SALE_FLAGGED',
            changes: {
              soldVehicleId: current.vehicleId,
              offeredVehicleId: command.alternativeVehicleId ?? null,
              note: command.note ?? null,
            },
          },
          tx,
        );

        await this.outboxRepository.publish(
          {
            aggregateType: 'Reservation',
            aggregateId: flagged.id,
            eventType: 'ReservationVehicleSaleFlagged',
            payload: {
              organizationId: context.organizationId,
              operatingCompanyId: command.companyId,
              branchId: command.branchId,
              soldVehicleId: current.vehicleId,
              offeredVehicleId: command.alternativeVehicleId ?? null,
              flaggedBy: command.firebaseUid,
            },
          },
          tx,
        );

        return flagged;
      },
      { isolationLevel: 'Serializable' },
    );
  }
}
