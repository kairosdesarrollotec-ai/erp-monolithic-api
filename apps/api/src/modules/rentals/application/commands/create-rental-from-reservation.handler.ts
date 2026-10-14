import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { RentalRepositoryPort, RentalRecord } from '../ports/rental-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import { CreateRentalFromReservationCommand } from './create-rental-from-reservation.command';

/**
 * RES-05 / ALQ-01 / RES-08 (UC-RES-005, BR-RES-002) - Crear Alquiler a partir
 * de una Reserva confirmada ("se presento" en el protocolo de no-show).
 * TDD-RES-001.md / TDD-03-alquiler.md seccion 8.2
 *
 * En UNA transaccion: (1) la reserva pasa CONFIRMED -> CONVERTED con un
 * `updateMany` atomico (scope completo + estado CONFIRMED en el where; si otra
 * operacion se adelanto, 409), (2) se crea el alquiler, (3) el
 * `vehicle_commitment` de la reserva se RE-ASIGNA al alquiler (RESERVATION ->
 * RENTAL, sigue CONSOLIDATED): el modulo de alquileres no crea compromisos
 * propios, y liberar el de la reserva dejaria el vehiculo libre durante el
 * alquiler. Al ser una reserva CONVERTED terminal, la regla compartida de
 * solape (common/persistence/vehicle-overlap.ts) ya no la cuenta, asi que no
 * hay doble conflicto consigo misma (ver DEC-RES-CONVERT-001). (4) auditoria
 * de reserva + alquiler y eventos outbox `ReservationConverted` /
 * `RentalCreatedFromReservation.v1`.
 *
 * Idempotente: reintentar sobre una reserva ya CONVERTED devuelve el alquiler
 * existente en vez de fallar. El monto pagado NO se toca aqui: sigue
 * trasladandose a la garantia en formalize-contract (P0-03 opcion a,
 * reservation-credit.ts acepta CONFIRMED y CONVERTED).
 */
@Injectable()
export class CreateRentalFromReservationHandler {
  constructor(
    private readonly rentals: RentalRepositoryPort,
    private readonly workContext: WorkContextAuthorizationService,
    private readonly matrixAuth: MatrixAuthorizationService,
    private readonly transactionManager: TransactionManagerPort,
    private readonly auditRepository: AuditEventRepositoryPort,
    private readonly outboxRepository: OutboxEventRepositoryPort,
  ) {}

  async execute(command: CreateRentalFromReservationCommand): Promise<RentalRecord> {
    const context = await this.workContext.authorize({
      firebaseUid: command.firebaseUid,
      companyId: command.companyId,
      branchId: command.branchId,
    });

    await this.matrixAuth.assertAllowed(context.organizationId, context.roleId, 'RENTAL', 'CREATE', { companyId: context.companyId, branchId: context.branchId });

    const reservation = await this.rentals.findReservationById(command.reservationId);
    if (
      !reservation ||
      reservation.organizationId !== context.organizationId ||
      reservation.operatingCompanyId !== context.companyId ||
      reservation.branchId !== context.branchId
    ) {
      throw new NotFoundException({
        code: 'RESERVATION_NOT_FOUND',
        detail: 'La reserva indicada no existe en esta empresa y sede.',
      });
    }

    const scope = {
      organizationId: context.organizationId,
      operatingCompanyId: context.companyId,
      branchId: context.branchId,
    };

    if (reservation.status === 'CONVERTED') {
      const existing = await this.rentals.findByReservationId(reservation.id, scope);
      if (existing) return existing;
    }

    if (reservation.status !== 'CONFIRMED') {
      throw new ConflictException({
        code: 'RESERVATION_NOT_CONFIRMED',
        detail: `No se puede iniciar el alquiler: la reserva se encuentra en estado ${reservation.status} (debe estar CONFIRMED).`,
      });
    }

    return this.transactionManager.run(async (tx) => {
      const converted = await this.rentals.markReservationConverted(reservation.id, scope, tx);
      if (!converted) {
        throw new ConflictException({
          code: 'RESERVATION_NOT_CONFIRMED',
          detail: 'No se puede iniciar el alquiler: la reserva cambio de estado mientras se procesaba (debe estar CONFIRMED).',
        });
      }

      const created = await this.rentals.create(
        {
          organizationId: context.organizationId,
          operatingCompanyId: context.companyId,
          branchId: context.branchId,
          customerId: reservation.customerId,
          vehicleId: reservation.vehicleId,
          reservationId: reservation.id,
          planCode: command.planCode ?? 'NORMAL',
          startAt: reservation.startAt,
          expectedEndAt: reservation.endAt,
          createdBy: command.firebaseUid,
        },
        tx,
      );

      const movedCommitments = await this.rentals.transferReservationCommitmentToRental(reservation.id, created.id, tx);

      await this.auditRepository.recordReservationEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.firebaseUid,
          reservationId: reservation.id,
          action: 'RESERVATION_CONVERTED',
          changes: { rentalId: created.id, vehicleId: reservation.vehicleId, commitmentsTransferred: movedCommitments },
        },
        tx,
      );

      await this.auditRepository.recordRentalEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.firebaseUid,
          rentalId: created.id,
          action: 'RENTAL_CREATED_FROM_RESERVATION',
          changes: {
            reservationId: reservation.id,
            status: created.status,
            customerId: created.customerId,
            vehicleId: created.vehicleId,
          },
        },
        tx,
      );

      await this.outboxRepository.publish(
        {
          aggregateType: 'Reservation',
          aggregateId: reservation.id,
          eventType: 'ReservationConverted',
          payload: {
            reservationId: reservation.id,
            rentalId: created.id,
            organizationId: context.organizationId,
            operatingCompanyId: context.companyId,
            branchId: context.branchId,
            vehicleId: reservation.vehicleId,
            convertedBy: command.firebaseUid,
          },
        },
        tx,
      );

      await this.outboxRepository.publish(
        {
          aggregateType: 'rental',
          aggregateId: created.id,
          eventType: 'RentalCreatedFromReservation.v1',
          payload: {
            rentalId: created.id,
            reservationId: reservation.id,
            organizationId: context.organizationId,
            operatingCompanyId: context.companyId,
            branchId: context.branchId,
            status: created.status,
            createdAt: created.createdAt.toISOString(),
          },
        },
        tx,
      );

      return created;
    });
  }
}
