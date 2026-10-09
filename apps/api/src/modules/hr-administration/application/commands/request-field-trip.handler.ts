import { Injectable } from '@nestjs/common';
import type { FieldTripRequest } from '@prisma/client';
import { ClockPort } from '../../../../common/application/ports/clock.port';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { HrAdministrationAccessService } from '../services/hr-administration-access.service';
import { FieldTripRepositoryPort } from '../ports/field-trip-repository.port';
import { EmployeeRepositoryPort } from '../ports/employee-repository.port';
import {
  EmployeeNotFoundError,
  EmployeeTerminatedError,
  InvalidFieldTripDatesError,
} from '../../domain/hr-administration-errors';
import { levelTimeoutFrom } from '../../domain/hr-administration-rules';
import { RequestFieldTripCommand } from './request-field-trip.command';

/** ADP-P12 / BR-ADP-004: la solicitud nace PENDIENTE_NIVEL_1 con el temporizador de 5 min del primer nivel. */
@Injectable()
export class RequestFieldTripHandler {
  constructor(
    private readonly access: HrAdministrationAccessService,
    private readonly fieldTrips: FieldTripRepositoryPort,
    private readonly employees: EmployeeRepositoryPort,
    private readonly transactionManager: TransactionManagerPort,
    private readonly clock: ClockPort,
    private readonly auditRepository: AuditEventRepositoryPort,
  ) {}

  async execute(command: RequestFieldTripCommand): Promise<FieldTripRequest> {
    const found = await this.employees.findById(command.employeeId);
    if (!found) {
      throw new EmployeeNotFoundError(command.employeeId);
    }

    const { context } = await this.access.authorize(
      {
        firebaseUid: command.firebaseUid,
        companyId: found.operatingCompanyId,
        branchId: found.branchId,
      },
      'REQUEST_FIELD_TRIP',
    );

    if (command.estimatedDeparture.getTime() >= command.estimatedReturn.getTime()) {
      throw new InvalidFieldTripDatesError();
    }

    return this.transactionManager.run(async (tx) => {
      const employee = await this.employees.findById(command.employeeId, tx);
      if (!employee) {
        throw new EmployeeNotFoundError(command.employeeId);
      }
      if (employee.status === 'TERMINADO') {
        throw new EmployeeTerminatedError(employee.id);
      }

      const created = await this.fieldTrips.create(
        {
          employeeId: employee.id,
          destination: command.destination.trim(),
          objective: command.objective.trim(),
          estimatedDeparture: command.estimatedDeparture,
          estimatedReturn: command.estimatedReturn,
          level1TimeoutAt: levelTimeoutFrom(this.clock.now()),
        },
        tx,
      );

      await this.auditRepository.recordHrAdministrationEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.firebaseUid,
          entityType: 'field_trip',
          entityId: created.id,
          action: 'FIELD_TRIP_REQUESTED',
          changes: {
            employeeId: created.employeeId,
            destination: created.destination,
            objective: created.objective,
            status: created.status,
            level1TimeoutAt: created.level1TimeoutAt,
          },
        },
        tx,
      );

      return created;
    });
  }
}
