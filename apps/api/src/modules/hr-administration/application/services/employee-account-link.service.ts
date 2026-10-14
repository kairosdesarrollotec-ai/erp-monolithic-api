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
