import { Injectable } from '@nestjs/common';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { HrAdministrationAccessService } from './hr-administration-access.service';

/** HU-35 (22-oct / 23-oct): campos sensibles de la ficha que solo ven los roles con permiso. */
export interface EmployeeFieldVisibility {
  /** HR_ADMINISTRATION.VIEW_EMPLOYEE_DOCUMENT o VIEW_EMPLOYEE_SENSITIVE_DATA */
  canViewDocument: boolean;
  /** HR_ADMINISTRATION.MANAGE_SALARY o VIEW_EMPLOYEE_SENSITIVE_DATA */
  canViewSalary: boolean;
  /** HR_ADMINISTRATION.VIEW_EMPLOYEE_SENSITIVE_DATA (DNI, sueldo, banco, contrato) */
  canViewSensitiveData: boolean;
}

export const FULL_EMPLOYEE_VISIBILITY: EmployeeFieldVisibility = {
  canViewDocument: true,
  canViewSalary: true,
  canViewSensitiveData: true,
};

/**
 * Resuelve qué campos sensibles (documentNumber, baseSalary, datos bancarios, contrato) puede ver el solicitante en el ámbito de la ficha.
 * La matriz ADM-02 es la fuente de permisos editables por rol.
 */
@Injectable()
export class EmployeeFieldVisibilityService {
  constructor(
    private readonly workContext: WorkContextAuthorizationService,
    private readonly access: HrAdministrationAccessService,
  ) {}

  async resolve(input: { firebaseUid: string; companyId: string; branchId: string }): Promise<EmployeeFieldVisibility> {
    const context = await this.workContext.authorize(input);
    const [canViewDocumentDirect, canViewSalaryDirect, canViewSensitiveData] = await Promise.all([
      this.access.isActionAllowed(context, 'VIEW_EMPLOYEE_DOCUMENT'),
      this.access.isActionAllowed(context, 'MANAGE_SALARY'),
      this.access.isActionAllowed(context, 'VIEW_EMPLOYEE_SENSITIVE_DATA'),
    ]);
    const canViewDocument = canViewSensitiveData || canViewDocumentDirect;
    const canViewSalary = canViewSensitiveData || canViewSalaryDirect;
    return { canViewDocument, canViewSalary, canViewSensitiveData };
  }
}
