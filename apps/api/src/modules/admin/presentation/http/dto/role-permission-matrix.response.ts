import type { PermissionModule } from '../../../domain/permission-action-catalog';

export class RolePermissionEntryResponse {
  roleId!: string;
  module!: PermissionModule;
  action!: string;
  allowed!: boolean;
}

export class PermissionActionResponse {
  module!: PermissionModule;
  action!: string;
  label!: string;
}

export class MatrixScopeResponse {
  companyId!: string | null;
  branchId!: string | null;
}

export class RolePermissionMatrixResponse {
  version!: number;
  scope!: MatrixScopeResponse;
  entries!: RolePermissionEntryResponse[];
  actionCatalog!: readonly PermissionActionResponse[];
}
