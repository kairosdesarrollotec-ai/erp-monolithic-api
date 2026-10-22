import { Injectable } from '@nestjs/common';
import type { Employee } from '@prisma/client';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { HrAdministrationAccessService } from '../services/hr-administration-access.service';
import { EmployeeRepositoryPort } from '../ports/employee-repository.port';
import {
  EmployeeNotFoundError,
  EmployeeSalaryGerenciaOnlyError,
  EmployeeTerminatedError,
  EmployeeVersionConflictError,
} from '../../domain/hr-administration-errors';
import { assertEmployeeStatusEditable } from '../../domain/hr-administration-rules';
import { EmployeeAccountLinkService } from '../services/employee-account-link.service';
import { HrAreaResolverService } from '../services/hr-area-resolver.service';
import { normalizeEmail } from '../../domain/hr-administration-rules';
import { UpdateEmployeeCommand } from './update-employee.command';

/** DEC-ADP-RELINK-001: resultado de la re-vinculación por cambio de correo (null si no hubo). */
export type AccountRelinkOutcome = 'RELINKED' | 'UNLINKED';

export interface UpdateEmployeeResult {
  employee: Employee;
  accountRelink: AccountRelinkOutcome | null;
  /** Correo de la ficha antes de la edición (para el aviso de re-vinculación). */
  previousEmail: string | null;
}

/** true si el sueldo pedido difiere del vigente (null y 0 son distintos: null = sin sueldo definido). */
function salaryChanged(current: Employee['baseSalary'], requested: number | null): boolean {
  const cur = current === null || current === undefined ? null : Number(current);
  return cur !== requested;
}

@Injectable()
export class UpdateEmployeeHandler {
  constructor(
    private readonly access: HrAdministrationAccessService,
    private readonly employees: EmployeeRepositoryPort,
    private readonly transactionManager: TransactionManagerPort,
    private readonly auditRepository: AuditEventRepositoryPort,
    private readonly accountLinker?: EmployeeAccountLinkService,
    private readonly areaResolver?: HrAreaResolverService,
  ) {}

  async execute(command: UpdateEmployeeCommand): Promise<Employee> {
    return (await this.executeDetailed(command)).employee;
  }

  /** Igual que `execute` pero informa si la edición re-vinculó (RELINKED) o desvinculó (UNLINKED) la cuenta. */
  async executeDetailed(command: UpdateEmployeeCommand): Promise<UpdateEmployeeResult> {
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

    // Respuestas 2026-10-20 #19: el sueldo base solo lo cambia Gerencia (MANAGE_SALARY). Un baseSalary igual al vigente (el front
    // suele reenviar la ficha completa) no cuenta como cambio; uno distinto sin el permiso -> 403 EMPLOYEE_SALARY_GERENCIA_ONLY.
    if (command.data.baseSalary !== undefined && salaryChanged(found.baseSalary, command.data.baseSalary)) {
      if (!(await this.access.isActionAllowed(context, 'MANAGE_SALARY'))) {
        throw new EmployeeSalaryGerenciaOnlyError();
      }
    }

    let data =
      command.data.email === undefined ? command.data : { ...command.data, email: normalizeEmail(command.data.email) };

    // H-02: `areaCode` (catalogo) o texto libre -> se resuelve a areaId/areaName normalizados (BR-ADP-002 compara `areaId`).
    if (data.areaCode !== undefined || data.areaId !== undefined || data.areaName !== undefined) {
      const { areaCode, areaId, areaName, ...others } = data;
      if (this.areaResolver) {
        const area = await this.areaResolver.resolve({
          operatingCompanyId: found.operatingCompanyId,
          areaCode,
          areaId,
          areaName,
        });
        data = { ...others, ...(area.areaId ? { areaId: area.areaId } : {}), ...(area.areaName ? { areaName: area.areaName } : {}) };
      } else {
        data = { ...others, ...(areaId !== undefined ? { areaId } : {}), ...(areaName !== undefined ? { areaName } : {}) };
      }
    }

    // Re-vinculación por cambio de correo: se resuelve la cuenta destino fuera de la transacción.
    const relinkTarget =
      data.email !== undefined && this.accountLinker
        ? await this.accountLinker.planRelinkOnEmailChange(found, data.email ?? null)
        : undefined;

    let accountRelink: AccountRelinkOutcome | null = null;
    const previousEmail = found.email ?? null;
    const result = await this.transactionManager.run(async (tx) => {
      const existing = await this.employees.findById(command.employeeId, tx);
      if (!existing) {
        throw new EmployeeNotFoundError(command.employeeId);
      }
      if (existing.status === 'TERMINADO') {
        throw new EmployeeTerminatedError(existing.id);
      }
      assertEmployeeStatusEditable(existing.status, data.status);
      if (command.expectedVersion !== undefined && existing.version !== command.expectedVersion) {
        throw new EmployeeVersionConflictError(existing.version);
      }

      let updated =
        command.expectedVersion === undefined
          ? await this.employees.update(command.employeeId, data, tx)
          : await this.employees.update(command.employeeId, data, tx, { expectedVersion: command.expectedVersion });
      const relink =
        relinkTarget !== undefined && this.accountLinker && existing.firebaseUid
          ? await this.accountLinker.applyRelink(updated, relinkTarget, tx)
          : null;
      if (relink) {
        updated = relink.employee;
        accountRelink = relink.action === 'EMPLOYEE_ACCOUNT_RELINKED' ? 'RELINKED' : 'UNLINKED';
      }

      await this.auditRepository.recordHrAdministrationEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.firebaseUid,
          entityType: 'employee',
          entityId: updated.id,
          action: 'EMPLOYEE_UPDATED',
          changes: { ...data } as Record<string, unknown>,
        },
        tx,
      );

      if (relink) {
        await this.auditRepository.recordHrAdministrationEvent(
          {
            organizationId: context.organizationId,
            actorUserId: command.firebaseUid,
            entityType: 'employee',
            entityId: updated.id,
            action: relink.action,
            changes: {
              reason: 'EMAIL_CHANGED',
              previousEmail: existing.email,
              newEmail: updated.email,
              previousFirebaseUid: existing.firebaseUid,
              linkedFirebaseUid: updated.firebaseUid,
            },
          },
          tx,
        );
      }

      return updated;
    });
    // DEC-ADP-LINK-EMAIL-002: ficha vinculada + correo cambiado -> se re-vincula a la cuenta del correo nuevo (o queda sin vincular, auditado).
    // DEC-ADP-LINK-EMAIL-001: al registrar/cambiar el correo se intenta vincular con la cuenta de ese correo (best-effort).
    const employee = command.data.email !== undefined && this.accountLinker ? await this.accountLinker.tryLink(result) : result;
    return { employee, accountRelink, previousEmail };
  }
}
