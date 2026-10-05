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

export function assertReturnRoleAllowed(role: WorkerRole, action: ReturnAction): void {
  if (role === 'PLATFORM_ADMIN') return;

  const allowedRoles = RETURN_ROLE_POLICY[action];
  if (!allowedRoles || !allowedRoles.has(role)) {
    throw new ReturnRoleNotAllowedError(role, action);
  }
}
