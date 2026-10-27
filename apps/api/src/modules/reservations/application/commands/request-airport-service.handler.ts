import { Injectable, NotFoundException } from '@nestjs/common';
import { ReservationRepositoryPort } from '../ports/reservation-repository.port';
import { AirportServiceRepositoryPort } from '../ports/airport-service-repository.port';
import { AirportServiceRecord } from '../../domain/airport-service';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import { ReservationStateConflictError, ReservationVersionConflictError } from '../../domain/reservation-errors';
import { RequestReservationAirportServiceCommand } from './request-airport-service.command';

@Injectable()
export class RequestReservationAirportServiceHandler {
  constructor(
    private readonly reservations: ReservationRepositoryPort,
    private readonly airportServices: AirportServiceRepositoryPort,
    private readonly workContext: WorkContextAuthorizationService,
    private readonly matrixAuth: MatrixAuthorizationService,
    private readonly auditRepository: AuditEventRepositoryPort,
    private readonly outboxRepository: OutboxEventRepositoryPort,
    private readonly transactionManager: TransactionManagerPort,
  ) {}

  async execute(command: RequestReservationAirportServiceCommand): Promise<AirportServiceRecord> {
    const context = await this.workContext.authorize({
      firebaseUid: command.firebaseUid,
      companyId: command.companyId,
      branchId: command.branchId,
    });
    await this.matrixAuth.assertAllowed(
      context.organizationId,
      context.roleId,
      'RESERVATION',
      'REQUEST_AIRPORT_SERVICE',
      {
        companyId: context.companyId,
        branchId: context.branchId,
      },
    );

    return this.transactionManager.run(async (tx) => {
      const scope = {
        organizationId: context.organizationId,
        operatingCompanyId: context.companyId,
        branchId: context.branchId,
      };

      const existing = await this.reservations.findById(command.id, scope, tx);
      if (!existing) {
        throw new NotFoundException(`Reserva ${command.id} no encontrada en este contexto.`);
      }

      if (existing.version !== command.expectedVersion) {
        throw new ReservationVersionConflictError();
      }

      if (existing.status === 'CANCELLED') {
        throw new ReservationStateConflictError('solicitar servicio de aeropuerto en', existing.status);
      }

      const airportService = await this.airportServices.recordAirportService(
        {
          organizationId: context.organizationId,
          operatingCompanyId: context.companyId,
          branchId: context.branchId,
          targetType: 'RESERVATION',
          targetId: command.id,
          scheduledAt: command.scheduledAt,
          location: command.location,
          additionalAmount: command.additionalAmount,
          notes: command.notes,
          registeredBy: command.firebaseUid,
        },
        tx,
      );

      await this.reservations.incrementVersion(command.id, scope, command.expectedVersion, tx);

      await this.auditRepository.recordReservationEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.firebaseUid,
          reservationId: command.id,
          action: 'RESERVATION_AIRPORT_SERVICE_REQUESTED',
          changes: {
            airportServiceId: airportService.id,
            scheduledAt: command.scheduledAt.toISOString(),
            location: command.location,
            additionalAmount: command.additionalAmount,
            notes: command.notes ?? null,
          },
        },
        tx,
      );

      await this.outboxRepository.publish(
        {
          aggregateType: 'reservation',
          aggregateId: command.id,
          eventType: 'ReservationAirportServiceRequested.v1',
          payload: {
            reservationId: command.id,
            airportServiceId: airportService.id,
            scheduledAt: command.scheduledAt.toISOString(),
            location: command.location,
            additionalAmount: command.additionalAmount,
          },
        },
        tx,
      );

      return airportService;
    });
  }
}
