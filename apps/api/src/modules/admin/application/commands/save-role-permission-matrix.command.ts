import type { PermissionModule } from '../../domain/permission-action-catalog';

export interface SaveRolePermissionMatrixEntryInput {
  roleId: string;
  module: PermissionModule;
  action: string;
  allowed: boolean;
}

export class SaveRolePermissionMatrixCommand {
  constructor(
    public readonly actorFirebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly entries: SaveRolePermissionMatrixEntryInput[],
    /** Ambito de la nueva version; omitido/null = toda la organizacion (o toda la empresa si solo hay scopeCompanyId). */
    public readonly scopeCompanyId?: string | null,
    public readonly scopeBranchId?: string | null,
  ) {}
}
