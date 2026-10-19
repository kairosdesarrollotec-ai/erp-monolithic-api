import { Injectable, Logger } from '@nestjs/common';
import type { Employee, Prisma } from '@prisma/client';
import { EmployeeRepositoryPort } from '../ports/employee-repository.port';
import { UserAccountEmailPort } from '../ports/user-account-email.port';
import {
  EmployeeAccountAlreadyLinkedError,
  EmployeeEmailRequiredError,
  UserAccountNotFoundError,
} from '../../domain/hr-administration-errors';
import { normalizeEmail } from '../../domain/hr-administration-rules';

/**
 * DEC-ADP-LINK-EMAIL-001: el vínculo usuario-ficha se hace POR CORREO (normalizado: trim + minúsculas). El correo de
 * la cuenta de acceso debe coincidir con el correo del colaborador. Una cuenta solo puede estar vinculada a una ficha
 * por empresa (índice único) y una ficha a una sola cuenta.
 */
@Injectable()
export class EmployeeAccountLinkService {
  private readonly logger = new Logger(EmployeeAccountLinkService.name);

  constructor(
    private readonly employees: EmployeeRepositoryPort,
    private readonly accounts: UserAccountEmailPort,
  ) {}

  /** Vinculación explícita: devuelve la ficha vinculada o lanza 422/404/409. Idempotente si ya apunta a esa cuenta. */
  async linkStrict(employee: Employee, tx?: Prisma.TransactionClient): Promise<Employee> {
    const email = normalizeEmail(employee.email);
    if (!email) throw new EmployeeEmailRequiredError();

    const uid = await this.accounts.findUidByEmail(email);
    if (!uid) throw new UserAccountNotFoundError(email);

    if (employee.firebaseUid === uid) return employee;
    if (employee.firebaseUid) {
      throw new EmployeeAccountAlreadyLinkedError(
        'La ficha ya está vinculada a otra cuenta de usuario; desvincúlala antes de enlazar el correo actual.',
      );
    }

    const owner = await this.employees.findByFirebaseUid(employee.operatingCompanyId, uid, tx);
    if (owner && owner.id !== employee.id) {
      throw new EmployeeAccountAlreadyLinkedError(
        `El correo ${email} ya está vinculado a otro colaborador de la empresa (${owner.fullName}).`,
      );
    }

    try {
      const linked = await this.employees.linkFirebaseUid(employee.id, uid, tx);
      if (linked.firebaseUid !== uid) {
        throw new EmployeeAccountAlreadyLinkedError('La ficha ya está vinculada a otra cuenta de usuario.');
      }
      return linked;
    } catch (error) {
      if ((error as { code?: string } | null)?.code === 'P2002') {
        throw new EmployeeAccountAlreadyLinkedError(`El correo ${email} ya está vinculado a otro colaborador de la empresa.`);
      }
      throw error;
    }
  }

  /**
   * Re-vinculación por cambio de correo (Fiorella, 16-oct-2026): si la ficha YA estaba vinculada y su correo cambia, la
   * ficha pasa a la cuenta del correo nuevo. Se resuelve ANTES de la transacción (llamada al proveedor de identidad).
   * Devuelve `undefined` si no hay nada que hacer (sin vínculo previo o correo sin cambio efectivo) o la cuenta destino
   * (uid) / `null` si no existe cuenta con el correo nuevo (la ficha queda SIN vincular y se audita).
   */
  async planRelinkOnEmailChange(employee: Employee, newEmail: string | null): Promise<string | null | undefined> {
    if (!employee.firebaseUid) return undefined;
    const target = normalizeEmail(newEmail);
    if (target === normalizeEmail(employee.email)) return undefined;
    if (!target) return null;
    return (await this.accounts.findUidByEmail(target)) ?? null;
  }

  /**
   * Aplica el plan dentro de la transacción. 409 (revierte toda la edición) si la cuenta destino ya está vinculada a
   * otro colaborador de la empresa. Devuelve la ficha resultante y la acción de auditoría a registrar (o null).
   */
  async applyRelink(
    employee: Employee,
    targetUid: string | null,
    tx: Prisma.TransactionClient,
  ): Promise<{ employee: Employee; action: 'EMPLOYEE_ACCOUNT_RELINKED' | 'EMPLOYEE_ACCOUNT_UNLINKED' } | null> {
    if (targetUid === employee.firebaseUid) return null;
    if (targetUid) {
      const owner = await this.employees.findByFirebaseUid(employee.operatingCompanyId, targetUid, tx);
      if (owner && owner.id !== employee.id) {
        throw new EmployeeAccountAlreadyLinkedError(
          `El correo nuevo ya está vinculado a otro colaborador de la empresa (${owner.fullName}); no se puede re-vincular esta ficha.`,
        );
      }
    }
    const updated = await this.employees.setFirebaseUid(employee.id, targetUid, tx);
    return { employee: updated, action: targetUid ? 'EMPLOYEE_ACCOUNT_RELINKED' : 'EMPLOYEE_ACCOUNT_UNLINKED' };
  }

  /** Vinculación oportunista al crear/editar: nunca falla ni bloquea; si hay conflicto o no hay cuenta, no hace nada. */
  async tryLink(employee: Employee): Promise<Employee> {
    if (employee.firebaseUid || employee.status === 'TERMINADO' || !normalizeEmail(employee.email)) return employee;
    try {
      return await this.linkStrict(employee);
    } catch (error) {
      this.logger.debug(`Vinculación automática omitida para ${employee.id}: ${(error as Error).message}`);
      return employee;
    }
  }
}
