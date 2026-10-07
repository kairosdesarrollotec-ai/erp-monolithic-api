import { Injectable } from '@nestjs/common';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import type { RoleRef } from '../../../users/domain/worker-role';
import { AdminMatrixAuthorizationService } from '../services/admin-matrix-authorization.service';
import { AdminUserRepositoryPort } from '../ports/admin-user-repository.port';
import { IdentityLookupPort } from '../ports/identity-lookup.port';
import { ListOrganizationUsersQuery } from './list-organization-users.query';

export interface OrganizationUserAssignmentResult {
  id: string;
  firebaseUid: string;
  email: string | null;
  companyId: string;
  companyName: string;
  branchId: string;
  branchName: string;
  role: RoleRef;
  active: boolean;
  mfaEnrolled: boolean;
}

/**
 * ADM-01 (Usuarios y asignaciones) - lista todas las asignaciones
 * empresa/sede/rol de la organizacion del admin, con correo (resuelto
 * via Firebase Authentication) y estado de MFA. Ver
 * PANTALLAS-V2-B-SOPORTE.md para el contrato completo.
 */
@Injectable()
export class ListOrganizationUsersHandler {
  constructor(
    private readonly workContext: WorkContextAuthorizationService,
    private readonly adminAuthorization: AdminMatrixAuthorizationService,
    private readonly adminUsers: AdminUserRepositoryPort,
    private readonly identity: IdentityLookupPort,
  ) {}

  async execute(query: ListOrganizationUsersQuery): Promise<OrganizationUserAssignmentResult[]> {
    const context = await this.workContext.authorize({
      firebaseUid: query.firebaseUid,
      companyId: query.companyId,
      branchId: query.branchId,
    });
    await this.adminAuthorization.assertAllowed(context.organizationId, context.roleId, 'MANAGE_USERS', { companyId: context.companyId, branchId: context.branchId });

    const assignments = await this.adminUsers.listAssignmentsByOrganization(context.organizationId);
    if (assignments.length === 0) return [];

    const uniqueUids = [...new Set(assignments.map((a) => a.firebaseUid))];
    const emailsByUid = await this.identity.findEmailsByUids(uniqueUids);

    return assignments.map((assignment) => ({
      id: assignment.id,
      firebaseUid: assignment.firebaseUid,
      email: emailsByUid[assignment.firebaseUid] ?? null,
      companyId: assignment.companyId,
      companyName: assignment.companyName,
      branchId: assignment.branchId,
      branchName: assignment.branchName,
      role: assignment.role,
      active: assignment.active,
      mfaEnrolled: assignment.mfaEnrolledAt !== null,
    }));
  }
}
