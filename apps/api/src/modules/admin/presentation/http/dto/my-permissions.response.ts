import type { RoleRef } from '../../../../users/domain/worker-role';
import type { PermissionModule } from '../../../domain/permission-action-catalog';

export class EffectivePermissionResponse {
  module!: PermissionModule;
  action!: string;
}

export class EffectivePermissionsResponse {
  role!: RoleRef;
  matrixVersion!: number;
  permissions!: EffectivePermissionResponse[];
}
