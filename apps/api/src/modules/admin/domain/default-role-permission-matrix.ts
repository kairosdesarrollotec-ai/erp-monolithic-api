import { WORKER_ROLES, type WorkerRole } from '../../users/domain/worker-role';
import { assertReservationRoleAllowed, ReservationAction } from '../../reservations/application/policies/reservation-role-policy';
import { assertInquiryRoleAllowed, InquiryAction } from '../../inquiries/application/policies/inquiry-role-policy';
import { assertRentalRoleAllowed, RentalAction } from '../../rentals/application/policies/rental-role-policy';
import { assertIncidentRoleAllowed, IncidentAction } from '../../incidents/application/policies/incident-role-policy';
import { assertRecruitmentRoleAllowed, RecruitmentAction } from '../../recruitment/application/policies/recruitment-role-policy';
import { assertHrAdministrationRoleAllowed, HrAdministrationAction } from '../../hr-administration/application/policies/hr-administration-role-policy';
import { assertAdminRoleAllowed, AdminAction } from '../application/policies/admin-role-policy';
import { assertReturnRoleAllowed, ReturnAction } from '../../returns/application/policies/return-role-policy';
import { assertFleetWrite, assertFleetRead, assertFleetCrossBranchPermission } from '../../fleet/application/policies/fleet-role.policy';
import { assertCustomerWrite, assertCustomerRead } from '../../customers/application/policies/customer-role.policy';
import { PERMISSION_ACTION_CATALOG, type PermissionModule } from './permission-action-catalog';
import { PLATFORM_ADMIN_KEY } from './system-roles';
import type { RolePermissionEntry } from '../application/ports/role-permission-matrix.port';

/**
 * Construye la version 0 (implicita) de la matriz de ADM-02 leyendo el
 * resultado REAL de los `*-role-policy.ts` existentes para cada
 * combinacion (rol de sistema, accion) del catalogo - en vez de mantener una
 * copia separada que se puede desincronizar.
 *
 * ROLES DINAMICOS: la version 0 solo conoce los roles de SISTEMA (los que
 * tienen `key`); cada `key` se mapea al `role_id` que esa organizacion tiene
 * sembrado. Un rol creado a mano nace sin ninguna entrada = cero permisos
 * (deny-by-default). El permiso total de PLATFORM_ADMIN sale de que su
 * policy lo permite todo (ya no hay atajo en la autorizacion: son filas).
 *
 * @param roleIdByKey key de sistema -> role_id de ESTA organizacion.
 */
export function buildDefaultRolePermissionMatrix(roleIdByKey: ReadonlyMap<string, string>): RolePermissionEntry[] {
  const entries: RolePermissionEntry[] = [];

  for (const key of WORKER_ROLES) {
    const roleId = roleIdByKey.get(key);
    if (!roleId) continue;
    for (const descriptor of PERMISSION_ACTION_CATALOG) {
      entries.push({
        roleId,
        module: descriptor.module,
        action: descriptor.action,
        // PLATFORM_ADMIN: todos los permisos del catalogo, sembrados como filas (sin atajo en la autorizacion).
        allowed: key === PLATFORM_ADMIN_KEY || isAllowedByExistingPolicy(key, descriptor.module, descriptor.action),
      });
    }
  }

  return entries;
}

function isAllowedByExistingPolicy(role: WorkerRole, module: PermissionModule, action: string): boolean {
  try {
    if (module === 'RESERVATION') {
      assertReservationRoleAllowed(role, action as ReservationAction);
    } else if (module === 'INQUIRY') {
      assertInquiryRoleAllowed(role, action as InquiryAction);
    } else if (module === 'RENTAL') {
      assertRentalRoleAllowed(role, action as RentalAction);
    } else if (module === 'INCIDENT') {
      assertIncidentRoleAllowed(role, action as IncidentAction);
    } else if (module === 'RETURN') {
      assertReturnRoleAllowed(role, action as ReturnAction);
    } else if (module === 'FLEET') {
      if (action === 'WRITE') assertFleetWrite(role);
      else if (action === 'READ') assertFleetRead(role);
      else assertFleetCrossBranchPermission(role);
    } else if (module === 'CUSTOMER') {
      if (action === 'WRITE') assertCustomerWrite(role);
      else assertCustomerRead(role);
    } else if (module === 'RECRUITMENT') {
      assertRecruitmentRoleAllowed(role, action as RecruitmentAction);
    } else if (module === 'HR_ADMINISTRATION') {
      assertHrAdministrationRoleAllowed(role, action as HrAdministrationAction);
    } else {
      assertAdminRoleAllowed(role, action as AdminAction);
    }
    return true;
  } catch {
    return false;
  }
}
