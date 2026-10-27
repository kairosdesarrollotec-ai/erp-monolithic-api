import { Injectable, NotFoundException } from '@nestjs/common';
import { RentalRepositoryPort } from '../ports/rental-repository.port';
import { AirportServiceRepositoryPort } from '../../../reservations/application/ports/airport-service-repository.port';
import { AirportServiceRecord } from '../../../reservations/domain/airport-service';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import { RentalStateConflictError, RentalVersionConflictError } from '../../domain/rental-errors';
import { RequestRentalAirportServiceCommand } from './request-airport-service.command';

@Injectable()
export class RequestRentalAirportServiceHandler {
  constructor(
    private readonly rentals: RentalRepositoryPort,
    private readonly airportServices: AirportServiceRepositoryPort,
    private readonly workContext: WorkContextAuthorizationService,
    private readonly matrixAuth: MatrixAuthorizationService,
    private readonly auditRepository: AuditEventRepositoryPort,
    private readonly outboxRepository: OutboxEventRepositoryPort,
    private readonly transactionManager: TransactionManagerPort,
  ) {}

  async execute(command: RequestRentalAirportServiceCommand): Promise<AirportServiceRecord> {
    const context = await this.workContext.authorize({
      firebaseUid: command.firebaseUid,
      companyId: command.companyId,
      branchId: command.branchId,
    });
    await this.matrixAuth.assertAllowed(
      context.organizationId,
      context.roleId,
      'RENTAL',
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

      const existing = await this.rentals.findById(command.id, scope, tx);
      if (!existing) {
        throw new NotFoundException(`Alquiler ${command.id} no encontrado en este contexto.`);
      }

      if (existing.version !== command.expectedVersion) {
        throw new RentalVersionConflictError();
      }

      if (existing.status === 'CANCELLED' || existing.status === 'CLOSED') {
        throw new RentalStateConflictError('solicitar servicio de aeropuerto en', existing.status);
      }

      const airportService = await this.airportServices.recordAirportService(
        {
          organizationId: context.organizationId,
          operatingCompanyId: context.companyId,
          branchId: context.branchId,
          targetType: 'RENTAL',
          targetId: command.id,
          scheduledAt: command.scheduledAt,
          location: command.location,
          additionalAmount: command.additionalAmount,
          notes: command.notes,
          registeredBy: command.firebaseUid,
        },
        tx,
      );

      await this.rentals.incrementVersion(command.id, scope, command.expectedVersion, tx);

      await this.auditRepository.recordRentalEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.firebaseUid,
          rentalId: command.id,
          action: 'RENTAL_AIRPORT_SERVICE_REQUESTED',
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
          aggregateType: 'rental',
          aggregateId: command.id,
          eventType: 'RentalAirportServiceRequested.v1',
          payload: {
            rentalId: command.id,
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
