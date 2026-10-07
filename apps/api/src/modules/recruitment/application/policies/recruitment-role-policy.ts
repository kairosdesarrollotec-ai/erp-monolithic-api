import { ForbiddenException } from '@nestjs/common';
import type { WorkerRole } from '../../../users/domain/worker-role';

/**
 * Política rol-acción de Reclutamiento y Selección (deny-by-default), versión 0 de la matriz ADM-02.
 * Análoga a `incident-role-policy.ts` y `rental-role-policy.ts`.
 *
 * ROLES DINÁMICOS (fase 2): esta política no decide en runtime si ya existe matriz persistida;
 * siembra la versión 0 de la matriz (`buildDefaultRolePermissionMatrix`, key de rol de sistema -> role_id).
 * PLATFORM_ADMIN no tiene atajo aquí: su "todo permitido" es una fila sembrada.
 *
 * Fuentes: BDD-05 (BDD-REC-001 v1.7), SDD-05 (SDD-REC-001 v2.0), TDD-05 (TDD-REC-001 v2.0)
 * y prototipos aprobados PROTO-REC-01 a PROTO-REC-08.
 *
 * Matriz inicial:
 * - GERENCIA / RRHH: Control total del proceso (10 acciones), incluyendo decisión de contratación (BR-REC-003).
 * - ADMINISTRACION: Gestión operativa, entrevistas, inducción/onboarding y registro de necesidad.
 * - FRONT_OFFICE: Registro/solicitud de necesidad de personal operativo y visualización de vacantes.
 * - CAMPO: Visualización de convocatorias de taller (vacantes mecánicos).
 * - AUDITORIA: Lectura básica (vacantes y candidatos), sin acceso a datos sensibles (BR-REC-005).
 * - FINANZAS: Visualización de vacantes y acceso a bandas salariales/pretensión económica (datos sensibles).
 */
export const RECRUITMENT_ACTIONS = [
  'VIEW_VACANCY',
  'CREATE_VACANCY',
  'PUBLISH_VACANCY',
  'REGISTER_CANDIDATE',
  'VIEW_CANDIDATE',
  'VIEW_CANDIDATE_SENSITIVE_DATA',
  'MANAGE_INTERVIEW',
  'DECIDE_CANDIDATE',
  'MANAGE_ONBOARDING',
  'EVALUATE_PROBATION',
] as const;

export type RecruitmentAction = (typeof RECRUITMENT_ACTIONS)[number];

const ALL_ROLES: ReadonlySet<WorkerRole> = new Set(['GERENCIA', 'RRHH']);

const RECRUITMENT_ROLE_POLICY: Readonly<Record<RecruitmentAction, ReadonlySet<WorkerRole>>> = {
  VIEW_VACANCY: new Set(['GERENCIA', 'RRHH', 'ADMINISTRACION', 'FRONT_OFFICE', 'CAMPO', 'AUDITORIA', 'FINANZAS']),
  CREATE_VACANCY: new Set(['GERENCIA', 'RRHH', 'ADMINISTRACION', 'FRONT_OFFICE']),
  PUBLISH_VACANCY: ALL_ROLES,
  REGISTER_CANDIDATE: new Set(['GERENCIA', 'RRHH', 'ADMINISTRACION']),
  VIEW_CANDIDATE: new Set(['GERENCIA', 'RRHH', 'ADMINISTRACION', 'AUDITORIA']),
  VIEW_CANDIDATE_SENSITIVE_DATA: new Set(['GERENCIA', 'RRHH', 'FINANZAS']),
  MANAGE_INTERVIEW: new Set(['GERENCIA', 'RRHH', 'ADMINISTRACION']),
  DECIDE_CANDIDATE: ALL_ROLES, // Exclusivo Gerencia / RRHH (BR-REC-003, DR-REC-002)
  MANAGE_ONBOARDING: new Set(['GERENCIA', 'RRHH', 'ADMINISTRACION']),
  EVALUATE_PROBATION: ALL_ROLES,
};

export function isRecruitmentRoleAllowed(role: WorkerRole, action: RecruitmentAction): boolean {
  return RECRUITMENT_ROLE_POLICY[action]?.has(role) ?? false;
}

export function assertRecruitmentRoleAllowed(role: WorkerRole, action: RecruitmentAction): void {
  if (!isRecruitmentRoleAllowed(role, action)) {
    throw new ForbiddenException({
      code: 'ROLE_NOT_ALLOWED',
      detail: `El rol ${role} no tiene permiso para realizar la accion ${action} sobre Reclutamiento.`,
    });
  }
}
