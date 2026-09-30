import { WORKER_ROLES } from '../../users/domain/worker-role';
import { assertReservationRoleAllowed, ReservationAction } from '../../reservations/application/policies/reservation-role-policy';
import { assertInquiryRoleAllowed, InquiryAction } from '../../inquiries/application/policies/inquiry-role-policy';
import { assertRentalRoleAllowed, RentalAction } from '../../rentals/application/policies/rental-role-policy';
import { assertAdminRoleAllowed, AdminAction } from '../application/policies/admin-role-policy';
import { PERMISSION_ACTION_CATALOG } from './permission-action-catalog';
import type { RolePermissionEntry } from '../application/ports/role-permission-matrix.port';

/**
 * Construye la version 0 (implicita) de la matriz de ADM-02 leyendo el
 * resultado REAL de los `*-role-policy.ts` existentes para cada
 * combinacion (rol, accion) del catalogo - en vez de mantener una copia
 * separada que se puede desincronizar. Ver la nota de alcance en
 * role-permission-matrix.port.ts: esto es solo para mostrar el estado
 * actual al abrir ADM-02 por primera vez, no cambia el enforcement.
 */
export function buildDefaultRolePermissionMatrix(): RolePermissionEntry[] {
  const entries: RolePermissionEntry[] = [];

  for (const role of WORKER_ROLES) {
    for (const descriptor of PERMISSION_ACTION_CATALOG) {
      entries.push({
        role,
        module: descriptor.module,
        action: descriptor.action,
        allowed: isAllowedByExistingPolicy(role, descriptor.module, descriptor.action),
      });
    }
  }

  return entries;
}

function isAllowedByExistingPolicy(
  role: (typeof WORKER_ROLES)[number],
  module: 'RESERVATION' | 'INQUIRY' | 'ADMIN' | 'RENTAL',
  action: string,
): boolean {
  try {
    if (module === 'RESERVATION') {
      assertReservationRoleAllowed(role, action as ReservationAction);
    } else if (module === 'INQUIRY') {
      assertInquiryRoleAllowed(role, action as InquiryAction);
    } else if (module === 'RENTAL') {
      assertRentalRoleAllowed(role, action as RentalAction);
    } else {
      assertAdminRoleAllowed(role, action as AdminAction);
    }
    return true;
  } catch {
    return false;
  }
}
