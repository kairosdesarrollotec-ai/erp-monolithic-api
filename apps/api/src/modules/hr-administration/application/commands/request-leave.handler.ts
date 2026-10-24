import { Injectable } from '@nestjs/common';
import type { LeaveRequest } from '@prisma/client';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { HrAdministrationAccessService } from '../services/hr-administration-access.service';
import { LeaveRepositoryPort } from '../ports/leave-repository.port';
import { EmployeeRepositoryPort } from '../ports/employee-repository.port';
import {
  EmployeeNotFoundError,
  EmployeeTerminatedError,
  InvalidDateRangeError,
} from '../../domain/hr-administration-errors';
import { RequestLeaveCommand } from './request-leave.command';

/**
 * ADP-P05: registra la solicitud de permiso / salida antes de hora (queda SOLICITADO).
 * Solicitar no es autorizar: la resolución es exclusiva de quienes tienen AUTHORIZE_LEAVE (BR-ADP-003).
 * R4: Si el colaborador solicita su propio permiso (autoservicio), se autoriza por contexto de trabajo.
 * Emite PermisoSolicitado.v1 al outbox para notificación in-app a Gerencia.
 */
@Injectable()
export class RequestLeaveHandler {
  constructor(
    private readonly access: HrAdministrationAccessService,
    private readonly leaves: LeaveRepositoryPort,
    private readonly employees: EmployeeRepositoryPort,
    private readonly transactionManager: TransactionManagerPort,
    private readonly auditRepository: AuditEventRepositoryPort,
    private readonly outboxRepository?: OutboxEventRepositoryPort,
  ) {}

  async execute(command: RequestLeaveCommand): Promise<LeaveRequest> {
    const found = await this.employees.findById(command.employeeId);
    if (!found) {
      throw new EmployeeNotFoundError(command.employeeId);
    }

    const isSelf = found.firebaseUid === command.firebaseUid;
    let organizationId: string;

    if (isSelf) {
      const ctx = await this.access.authorizeWorkContext({
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
        ['MANAGE_EMPLOYEES', 'AUTHORIZE_LEAVE', 'REQUEST_FIELD_TRIP'],
      );
      organizationId = context.organizationId;
    }

    if (command.startTime && command.endTime && command.startTime.getTime() >= command.endTime.getTime()) {
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

      const created = await this.leaves.create(
        {
          employeeId: command.employeeId,
          type: command.type,
          date: command.date,
          startTime: command.startTime ?? null,
          endTime: command.endTime ?? null,
          reason: command.reason.trim(),
        },
        tx,
      );

      if (this.outboxRepository) {
        await this.outboxRepository.publish(
          {
            aggregateType: 'LeaveRequest',
            aggregateId: created.id,
            eventType: 'PermisoSolicitado.v1',
            payload: {
              leaveId: created.id,
              employeeId: employee.id,
              employeeName: employee.fullName,
              type: created.type,
              date: created.date.toISOString(),
              reason: created.reason,
              actorUserId: command.firebaseUid,
              organizationId,
              operatingCompanyId: employee.operatingCompanyId,
              branchId: employee.branchId,
            },
          },
          tx,
        );
      }

      await this.auditRepository.recordHrAdministrationEvent(
        {
          organizationId,
          actorUserId: command.firebaseUid,
          entityType: 'leave',
          entityId: created.id,
          action: 'LEAVE_REQUESTED',
          changes: {
            employeeId: created.employeeId,
            type: created.type,
            date: created.date,
            status: created.status,
          },
        },
        tx,
      );

      return created;
    });
  }
}
