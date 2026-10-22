import { Injectable } from '@nestjs/common';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { HrAdministrationAccessService } from './hr-administration-access.service';

/** HU-35 (22-oct): campos sensibles de la ficha que solo ven los roles con permiso. */
export interface EmployeeFieldVisibility {
  /** HR_ADMINISTRATION.VIEW_EMPLOYEE_DOCUMENT */
  canViewDocument: boolean;
  /** HR_ADMINISTRATION.MANAGE_SALARY */
  canViewSalary: boolean;
}

export const FULL_EMPLOYEE_VISIBILITY: EmployeeFieldVisibility = { canViewDocument: true, canViewSalary: true };

/**
 * Resuelve que campos sensibles (documentNumber, baseSalary) puede ver el solicitante en el ambito de la ficha. El handler que
 * entrega la ficha ya autorizo el acceso al ambito; este servicio solo evalua los dos permisos de visibilidad (la matriz ADM-02
 * es la fuente: editables por rol).
 */
@Injectable()
export class EmployeeFieldVisibilityService {
  constructor(
    private readonly workContext: WorkContextAuthorizationService,
    private readonly access: HrAdministrationAccessService,
  ) {}

  async resolve(input: { firebaseUid: string; companyId: string; branchId: string }): Promise<EmployeeFieldVisibility> {
    const context = await this.workContext.authorize(input);
    const [canViewDocument, canViewSalary] = await Promise.all([
      this.access.isActionAllowed(context, 'VIEW_EMPLOYEE_DOCUMENT'),
      this.access.isActionAllowed(context, 'MANAGE_SALARY'),
    ]);
    return { canViewDocument, canViewSalary };
  }
}
