import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { RentalRepositoryPort, RentalRecord } from '../ports/rental-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import { CreateRentalFromReservationCommand } from './create-rental-from-reservation.command';

/**
 * RES-05 / ALQ-01 - Crear Alquiler a partir de una Reserva confirmada.
 * TDD-RES-001.md / TDD-03-alquiler.md seccion 8.2
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

    await this.matrixAuth.assertAllowed(context.organizationId, context.role, 'RENTAL', 'CREATE');

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

    if (reservation.status !== 'CONFIRMED') {
      throw new ConflictException({
        code: 'RESERVATION_NOT_CONFIRMED',
        detail: `No se puede iniciar el alquiler: la reserva se encuentra en estado ${reservation.status} (debe estar CONFIRMED).`,
      });
    }

    return this.transactionManager.run(async (tx) => {
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
