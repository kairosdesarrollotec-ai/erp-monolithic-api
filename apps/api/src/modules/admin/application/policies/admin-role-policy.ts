import { ForbiddenException } from '@nestjs/common';
import type { WorkerRole } from '../../../users/domain/worker-role';

/**
 * ADM-01 a ADM-05 (PANTALLAS-V2-B-SOPORTE.md): "Roles y alcance:
 * Administracion" en los 5 contratos - a diferencia de otros modulos
 * (Reservations), aqui no hay ambiguedad jerarquica que documentar: la
 * pantalla es explicita en que este es el unico rol con acceso, tanto
 * para lectura como escritura (ADM-04, auditoria administrativa, tambien
 * la ve Auditoria - se agrega esa excepcion puntual en la accion de solo
 * lectura, no en las de escritura).
 *
 * Mismo criterio PROVISIONAL que reservation-role-policy.ts: esto NO es
 * ADM-02 (la matriz real, todavia no construida) - es la politica minima
 * mientras tanto.
 */
export type AdminAction = 'MANAGE_USERS' | 'VIEW_AUDIT' | 'MANAGE_PARAMETERS' | 'MANAGE_PERMISSIONS' | 'MANAGE_NOTIFICATIONS';

const ADMIN_ROLE_POLICY: Readonly<Record<AdminAction, ReadonlySet<WorkerRole>>> = {
  MANAGE_USERS: new Set(['ADMINISTRACION']),
  VIEW_AUDIT: new Set(['ADMINISTRACION', 'AUDITORIA']),
  MANAGE_PARAMETERS: new Set(['ADMINISTRACION']),
  MANAGE_PERMISSIONS: new Set(['ADMINISTRACION']),
  MANAGE_NOTIFICATIONS: new Set(['ADMINISTRACION']),
};

// ROLES DINAMICOS (fase 2): esta politica ya NO decide en runtime; solo SIEMBRA la version 0 de la matriz ADM-02
// (key de rol de sistema -> role_id). Sin atajo PLATFORM_ADMIN: su "todo permitido" es una fila sembrada.
export function assertAdminRoleAllowed(role: WorkerRole, action: AdminAction): void {
  if (!ADMIN_ROLE_POLICY[action].has(role)) {
    throw new ForbiddenException({
      code: 'ROLE_NOT_ALLOWED',
      detail: `El rol ${role} no tiene permiso para realizar esta accion administrativa.`,
    });
  }
}
