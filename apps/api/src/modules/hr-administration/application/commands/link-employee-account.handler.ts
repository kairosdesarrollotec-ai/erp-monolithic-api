import { Injectable } from '@nestjs/common';
import type { Employee } from '@prisma/client';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { HrAdministrationAccessService } from '../services/hr-administration-access.service';
import { EmployeeAccountLinkService } from '../services/employee-account-link.service';
import { EmployeeRepositoryPort } from '../ports/employee-repository.port';
import { EmployeeNotFoundError, EmployeeTerminatedError } from '../../domain/hr-administration-errors';
import { LinkEmployeeAccountCommand } from './link-employee-account.command';

/**
 * DEC-ADP-LINK-EMAIL-001: vincula explícitamente la ficha del colaborador con la cuenta de usuario cuyo correo
 * coincide (sin distinguir mayúsculas). 422 sin correo en la ficha, 404 sin cuenta, 409 si el correo ya está
 * vinculado a otro colaborador (o la ficha a otra cuenta). Idempotente si ya estaba vinculada a esa cuenta.
 */
@Injectable()
export class LinkEmployeeAccountHandler {
  constructor(
    private readonly access: HrAdministrationAccessService,
    private readonly employees: EmployeeRepositoryPort,
    private readonly linker: EmployeeAccountLinkService,
    private readonly transactionManager: TransactionManagerPort,
    private readonly auditRepository: AuditEventRepositoryPort,
  ) {}

  async execute(command: LinkEmployeeAccountCommand): Promise<Employee> {
    const found = await this.employees.findById(command.employeeId);
    if (!found) throw new EmployeeNotFoundError(command.employeeId);

    const { context } = await this.access.authorize(
      { firebaseUid: command.firebaseUid, companyId: found.operatingCompanyId, branchId: found.branchId },
      'MANAGE_EMPLOYEES',
    );
    if (found.status === 'TERMINADO') throw new EmployeeTerminatedError(found.id);

    return this.transactionManager.run(async (tx) => {
      const linked = await this.linker.linkStrict(found, tx);
      if (linked.firebaseUid !== found.firebaseUid) {
        await this.auditRepository.recordHrAdministrationEvent(
          {
            organizationId: context.organizationId,
            actorUserId: command.firebaseUid,
            entityType: 'employee',
            entityId: linked.id,
            action: 'EMPLOYEE_ACCOUNT_LINKED',
            changes: { linkedBy: 'EMAIL', linkedFirebaseUid: linked.firebaseUid },
          },
          tx,
        );
      }
      return linked;
    });
  }
}
