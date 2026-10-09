import { Injectable } from '@nestjs/common';
import type { Employee } from '@prisma/client';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { HrAdministrationAccessService } from '../services/hr-administration-access.service';
import { EmployeeRepositoryPort } from '../ports/employee-repository.port';
import { EmployeeNotFoundError, EmployeeTerminatedError } from '../../domain/hr-administration-errors';
import { assertEmployeeStatusEditable } from '../../domain/hr-administration-rules';
import { UpdateEmployeeCommand } from './update-employee.command';

@Injectable()
export class UpdateEmployeeHandler {
  constructor(
    private readonly access: HrAdministrationAccessService,
    private readonly employees: EmployeeRepositoryPort,
    private readonly transactionManager: TransactionManagerPort,
    private readonly auditRepository: AuditEventRepositoryPort,
  ) {}

  async execute(command: UpdateEmployeeCommand): Promise<Employee> {
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
      'MANAGE_EMPLOYEES',
    );

    return this.transactionManager.run(async (tx) => {
      const existing = await this.employees.findById(command.employeeId, tx);
      if (!existing) {
        throw new EmployeeNotFoundError(command.employeeId);
      }
      if (existing.status === 'TERMINADO') {
        throw new EmployeeTerminatedError(existing.id);
      }
      assertEmployeeStatusEditable(existing.status, command.data.status);

      const updated = await this.employees.update(command.employeeId, command.data, tx);

      await this.auditRepository.recordHrAdministrationEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.firebaseUid,
          entityType: 'employee',
          entityId: updated.id,
          action: 'EMPLOYEE_UPDATED',
          changes: { ...command.data } as Record<string, unknown>,
        },
        tx,
      );

      return updated;
    });
  }
}
