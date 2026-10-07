import type { RoleWithAssignmentCount } from '../../application/ports/role-repository.port';
import type { RoleResponse } from './dto/role.response';

export function toRoleResponse(role: RoleWithAssignmentCount): RoleResponse {
  return {
    id: role.id,
    name: role.name,
    key: role.key,
    isSystem: role.isSystem,
    active: role.active,
    version: role.version,
    assignmentCount: role.assignmentCount,
  };
}
