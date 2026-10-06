import { Injectable } from '@nestjs/common';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { AdminMatrixAuthorizationService } from '../services/admin-matrix-authorization.service';
import { AdminUserRepositoryPort } from '../ports/admin-user-repository.port';
import { GetOrganizationCompaniesQuery } from './get-organization-companies.query';

export interface OrganizationBranchResult {
  branchId: string;
  branchName: string;
}

export interface OrganizationCompanyResult {
  companyId: string;
  companyName: string;
  branches: OrganizationBranchResult[];
}

/**
 * ADM-01 (Usuarios y asignaciones) - lista las empresas y sedes de la
 * organizacion del admin, para poblar el selector Empresa/Sede del
 * formulario "Agregar usuario" (que hoy solo conoce el contexto de
 * trabajo actual del admin, no el grupo completo). Ver
 * PANTALLAS-V2-B-SOPORTE.md.
 */
@Injectable()
export class GetOrganizationCompaniesHandler {
  constructor(
    private readonly workContext: WorkContextAuthorizationService,
    private readonly adminAuthorization: AdminMatrixAuthorizationService,
    private readonly adminUsers: AdminUserRepositoryPort,
  ) {}

  async execute(query: GetOrganizationCompaniesQuery): Promise<OrganizationCompanyResult[]> {
    const context = await this.workContext.authorize({
      firebaseUid: query.firebaseUid,
      companyId: query.companyId,
      branchId: query.branchId,
    });
    await this.adminAuthorization.assertAllowed(context.organizationId, context.roleId, 'MANAGE_USERS', { companyId: context.companyId, branchId: context.branchId });

    return this.adminUsers.listCompaniesWithBranches(context.organizationId);
  }
}
