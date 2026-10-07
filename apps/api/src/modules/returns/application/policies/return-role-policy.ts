import type { WorkerRole } from '../../../users/domain/worker-role';
import { ReturnRoleNotAllowedError } from '../../domain/return-errors';

export type ReturnAction =
  | 'CREATE'
  | 'READ'
  | 'RECEIVE_PROVISIONAL'
  | 'REGISTER_ALCOHOL_TEST'
  | 'RESOLVE_ALCOHOL_ESCALATION'
  | 'COMPLETE_INSPECTION'
  | 'ASSESS_DAMAGE'
  | 'CHARGE_IMMOBILIZATION'
  | 'CLOSE_FINANCIAL'
  | 'CLOSE'
  | 'UPLOAD_EVIDENCE';

const FIELD_OPERATIONAL_ROLES: ReadonlySet<WorkerRole> = new Set([
  'FRONT_OFFICE',
  'ADMINISTRACION',
  'GERENCIA',
  'CAMPO',
]);

/**
 * PROVISIONAL (mismo criterio que rental-role-policy): deny-by-default por rol+acción hasta que ADM-02
 * incorpore el módulo RETURN a la matriz versionada (MatrixModule hoy solo conoce RESERVATION/INQUIRY/ADMIN/RENTAL).
 */
const RETURN_ROLE_POLICY: Readonly<Record<ReturnAction, ReadonlySet<WorkerRole>>> = {
  CREATE: new Set(['FRONT_OFFICE', 'ADMINISTRACION', 'GERENCIA']),
  READ: new Set(['FRONT_OFFICE', 'ADMINISTRACION', 'GERENCIA', 'AUDITORIA', 'FINANZAS', 'CAMPO']),
  RECEIVE_PROVISIONAL: FIELD_OPERATIONAL_ROLES,
  REGISTER_ALCOHOL_TEST: FIELD_OPERATIONAL_ROLES,
  // PROP-014 (provisional): solo Gerencia decide ante alcolímetro desfavorable (BR-DEV-005). No existe rol
  // SUBGERENCIA en WorkerRole; cuando ADM-02 lo incorpore se agrega aquí.
  RESOLVE_ALCOHOL_ESCALATION: new Set(['GERENCIA']),
  COMPLETE_INSPECTION: FIELD_OPERATIONAL_ROLES,
  ASSESS_DAMAGE: new Set(['ADMINISTRACION', 'GERENCIA']),
  CHARGE_IMMOBILIZATION: new Set(['ADMINISTRACION', 'GERENCIA', 'FINANZAS']),
  CLOSE_FINANCIAL: new Set(['FINANZAS', 'ADMINISTRACION', 'GERENCIA']),
  CLOSE: new Set(['ADMINISTRACION', 'GERENCIA']),
  UPLOAD_EVIDENCE: FIELD_OPERATIONAL_ROLES,
};

/**
 * TODO(roles-dinamicos, fase 4): este modulo AUN decide con un set de roles
 * hard-coded, ahora contra `roleKey` (clave estable de los 8 roles de sistema,
 * AuthorizedWorkContext.roleKey). Un rol creado a mano (key = null) queda
 * DENEGADO aqui (deny-by-default) hasta que el modulo migre a la matriz ADM-02
 * (MatrixAuthorizationService.assertAllowed por roleId) en su propio PR de la
 * fase 4. No migrar en el PR de la fase 2.
 */
export function assertReturnRoleAllowed(role: WorkerRole | null, action: ReturnAction): void {
  // Fase 4: este atajo (sobre la clave de sistema, no sobre el rol dinamico) desaparece cuando
  // Devoluciones migre a la matriz, donde PLATFORM_ADMIN tiene filas sembradas.
  if (role === 'PLATFORM_ADMIN') return;

  const allowedRoles = RETURN_ROLE_POLICY[action];
  if (role === null || !allowedRoles || !allowedRoles.has(role)) {
    throw new ReturnRoleNotAllowedError(role ?? 'sin clave de sistema', action);
  }
}
