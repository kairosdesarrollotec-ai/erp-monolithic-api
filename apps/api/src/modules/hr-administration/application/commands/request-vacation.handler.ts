import { Injectable } from '@nestjs/common';
import type { VacationRequest } from '@prisma/client';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { HrAdministrationAccessService } from '../services/hr-administration-access.service';
import { VacationRepositoryPort } from '../ports/vacation-repository.port';
import { EmployeeRepositoryPort } from '../ports/employee-repository.port';
import {
  EmployeeNotFoundError,
  EmployeeTerminatedError,
  InvalidDateRangeError,
} from '../../domain/hr-administration-errors';
import { RequestVacationCommand } from './request-vacation.command';

/**
 * R4: Solicitud de vacaciones por el propio colaborador (autoservicio).
 * Queda en estado SOLICITADA y emite VacacionSolicitada.v1 al outbox para notificación in-app a Gerencia.
 */
@Injectable()
export class RequestVacationHandler {
  constructor(
    private readonly access: HrAdministrationAccessService,
    private readonly workContext: WorkContextAuthorizationService,
    private readonly vacations: VacationRepositoryPort,
    private readonly employees: EmployeeRepositoryPort,
    private readonly transactionManager: TransactionManagerPort,
    private readonly auditRepository: AuditEventRepositoryPort,
    private readonly outboxRepository: OutboxEventRepositoryPort,
  ) {}

  async execute(command: RequestVacationCommand): Promise<VacationRequest> {
    const found = await this.employees.findById(command.employeeId);
    if (!found) {
      throw new EmployeeNotFoundError(command.employeeId);
    }

    const isSelf = found.firebaseUid === command.firebaseUid;
    let organizationId: string;

    if (isSelf) {
      const ctx = await this.workContext.authorize({
        firebaseUid: command.firebaseUid,
        companyId: found.operatingCompanyId,
        branchId: found.branchId,
      });
      organizationId = ctx.organizationId;
    } else {
      const { context } = await this.access.authorizeAny(
        {
          firebaseUid: command.firebaseUid,
          companyId: found.operatingCompanyId,
          branchId: found.branchId,
        },
        ['SCHEDULE_VACATION', 'MANAGE_EMPLOYEES'],
      );
      organizationId = context.organizationId;
    }

    if (command.startDate.getTime() > command.endDate.getTime()) {
      throw new InvalidDateRangeError();
    }

    return this.transactionManager.run(async (tx) => {
      const employee = await this.employees.findById(command.employeeId, tx);
      if (!employee) {
        throw new EmployeeNotFoundError(command.employeeId);
      }
      if (employee.status === 'TERMINADO') {
        throw new EmployeeTerminatedError(employee.id);
      }

      const created = await this.vacations.create(
        {
          employeeId: employee.id,
          operatingCompanyId: employee.operatingCompanyId,
          areaId: employee.areaId,
          startDate: command.startDate,
          endDate: command.endDate,
          notes: command.notes?.trim() || null,
          status: 'SOLICITADA',
        },
        tx,
      );

      await this.outboxRepository.publish(
        {
          aggregateType: 'VacationRequest',
          aggregateId: created.id,
          eventType: 'VacacionSolicitada.v1',
          payload: {
            vacationId: created.id,
            employeeId: employee.id,
            employeeName: employee.fullName,
            startDate: created.startDate.toISOString(),
            endDate: created.endDate.toISOString(),
            notes: created.notes,
            actorUserId: command.firebaseUid,
            organizationId,
            operatingCompanyId: employee.operatingCompanyId,
            branchId: employee.branchId,
          },
        },
        tx,
      );

      await this.auditRepository.recordHrAdministrationEvent(
        {
          organizationId,
          actorUserId: command.firebaseUid,
          entityType: 'vacation',
          entityId: created.id,
          action: 'VACATION_REQUESTED',
          changes: {
            employeeId: created.employeeId,
            areaId: created.areaId,
            startDate: created.startDate,
            endDate: created.endDate,
            status: created.status,
          },
        },
        tx,
      );

      return created;
    });
  }
}
