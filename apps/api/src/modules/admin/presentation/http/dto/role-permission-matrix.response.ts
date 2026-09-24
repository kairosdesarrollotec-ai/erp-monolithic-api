import type { WorkerRole } from '../../../../users/domain/worker-role';

export class RolePermissionEntryResponse {
  role!: WorkerRole;
  module!: 'RESERVATION' | 'INQUIRY' | 'ADMIN';
  action!: string;
  allowed!: boolean;
}

export class PermissionActionResponse {
  module!: 'RESERVATION' | 'INQUIRY' | 'ADMIN';
  action!: string;
  label!: string;
}

export class RolePermissionMatrixResponse {
  version!: number;
  entries!: RolePermissionEntryResponse[];
  actionCatalog!: readonly PermissionActionResponse[];
}
