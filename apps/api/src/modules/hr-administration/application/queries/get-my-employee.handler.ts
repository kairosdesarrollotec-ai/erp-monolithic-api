import { Injectable } from '@nestjs/common';
import type { Employee } from '@prisma/client';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { EmployeeRepositoryPort } from '../ports/employee-repository.port';
import { UserAccountEmailPort } from '../ports/user-account-email.port';
import { EmployeeNotLinkedError } from '../../domain/hr-administration-errors';
import { GetMyEmployeeQuery } from './get-my-employee.query';

/**
 * ADP-06: un trabajador de campo encuentra SU PROPIA ficha sin elegir colaborador a mano. No exige ningún permiso de
 * Personal (como `GET /me/permissions`): solo una asignación vigente en esa empresa/sede, y solo devuelve la ficha del
 * propio usuario. La vinculación usuario-ficha se resuelve así:
 *  1. ficha ya vinculada a su cuenta de acceso en esa empresa;
 *  2. si no, la única ficha vigente de la empresa con el mismo correo que su cuenta; en ese caso queda vinculada para
 *     las siguientes consultas. Si hay 0 o más de 1 coincidencia no se adivina: EMPLOYEE_NOT_LINKED.
 */
@Injectable()
export class GetMyEmployeeHandler {
  constructor(
    private readonly workContext: WorkContextAuthorizationService,
    private readonly employees: EmployeeRepositoryPort,
    private readonly accountEmail: UserAccountEmailPort,
  ) {}

  async execute(query: GetMyEmployeeQuery): Promise<Employee> {
    const context = await this.workContext.authorize({
      firebaseUid: query.firebaseUid,
      companyId: query.companyId,
      branchId: query.branchId,
    });

    const linked = await this.employees.findByFirebaseUid(context.companyId, query.firebaseUid);
    if (linked) {
      if (linked.status === 'TERMINADO') throw new EmployeeNotLinkedError();
      return linked;
    }

    const email = await this.accountEmail.findEmail(query.firebaseUid);
    if (!email) throw new EmployeeNotLinkedError();

    const candidates = await this.employees.findActiveByEmail(context.companyId, email);
    if (candidates.length !== 1 || candidates[0].firebaseUid) throw new EmployeeNotLinkedError();

    return this.employees.linkFirebaseUid(candidates[0].id, query.firebaseUid);
  }
}
