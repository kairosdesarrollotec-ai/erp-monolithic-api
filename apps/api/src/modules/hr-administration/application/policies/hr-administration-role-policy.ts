import { ForbiddenException } from '@nestjs/common';
import type { WorkerRole } from '../../../users/domain/worker-role';

/**
 * Política rol-acción de Administración de Personal (deny-by-default), versión 0 de la matriz ADM-02.
 * Análoga a `recruitment-role-policy.ts`, `incident-role-policy.ts` y `rental-role-policy.ts`.
 *
 * Fuentes canónicas:
 *   - BDD-06 (BDD-ADP-001 v1.9): subflujos de asistencia, permisos, vacaciones, campo y desvinculación.
 *   - SDD-06 (v2.1) / TDD-06 (v2.1): reglas de negocio BR-ADP-001 a BR-ADP-006.
 *
 * Reglas de autorización específicas:
 *   - GERENCIA / RRHH: Control total del proceso (10 acciones).
 *   - ADMINISTRACION: Gestión operativa, registro de asistencia, colaboradores, programación de vacaciones,
 *     solicitud y evaluación de retorno de campo.
 *   - CAMPO / FRONT_OFFICE: Solicitud de salidas a campo (`REQUEST_FIELD_TRIP`).
 *   - Capacitación interna (ADP-10): solo RR.HH. (y Gerencia) registra talleres (`REGISTER_TRAINING`).
 *   - AUDITORIA: Lectura de expedientes de colaboradores (`VIEW_EMPLOYEES`).
 *   - FINANZAS: Consulta de colaboradores y acceso a asistencias para cálculo de nómina y deducciones.
 *   - PLATFORM_ADMIN: todo permitido vía fila sembrada en la matriz dinámica.
 *   - 22-oct (Respuestas #9 y HU-35): LOG_OWN_ATTENDANCE / REVIEW_ATTENDANCE / MANAGE_GEOFENCE / VIEW_EMPLOYEE_DOCUMENT.
 */
export const HR_ADMINISTRATION_ACTIONS = [
  'VIEW_EMPLOYEES',
  'MANAGE_EMPLOYEES',
  'LOG_ATTENDANCE',
  'AUTHORIZE_LEAVE',
  'SCHEDULE_VACATION',
  'REQUEST_FIELD_TRIP',
  'AUTHORIZE_FIELD_TRIP',
  'EVALUATE_FIELD_TRIP_RETURN',
  'TERMINATE_EMPLOYMENT',
  'REGISTER_TRAINING',
  'MANAGE_AREAS',
  'MANAGE_SALARY',
  'LOG_OWN_ATTENDANCE',
  'REVIEW_ATTENDANCE',
  'MANAGE_GEOFENCE',
  'VIEW_EMPLOYEE_DOCUMENT',
] as const;

export type HrAdministrationAction = (typeof HR_ADMINISTRATION_ACTIONS)[number];

const LEADERSHIP_ROLES: ReadonlySet<WorkerRole> = new Set(['GERENCIA', 'RRHH']);

const HR_ADMINISTRATION_ROLE_POLICY: Readonly<Record<HrAdministrationAction, ReadonlySet<WorkerRole>>> = {
  VIEW_EMPLOYEES: new Set(['GERENCIA', 'RRHH', 'ADMINISTRACION', 'AUDITORIA', 'FINANZAS']),
  MANAGE_EMPLOYEES: new Set(['GERENCIA', 'RRHH', 'ADMINISTRACION']),
  LOG_ATTENDANCE: new Set(['GERENCIA', 'RRHH', 'ADMINISTRACION', 'FINANZAS']),
  AUTHORIZE_LEAVE: LEADERSHIP_ROLES, // Exclusivo de quienes tienen este permiso (BR-ADP-003): nunca por nombre
  SCHEDULE_VACATION: new Set(['GERENCIA', 'RRHH', 'ADMINISTRACION']),
  REQUEST_FIELD_TRIP: new Set(['GERENCIA', 'RRHH', 'ADMINISTRACION', 'CAMPO', 'FRONT_OFFICE']),
  AUTHORIZE_FIELD_TRIP: LEADERSHIP_ROLES, // Cascada genérica N1..N3 (BR-ADP-004): la autoriza el permiso, no una persona fija
  EVALUATE_FIELD_TRIP_RETURN: new Set(['GERENCIA', 'RRHH', 'ADMINISTRACION']),
  TERMINATE_EMPLOYMENT: LEADERSHIP_ROLES, // Exclusivo Gerencia / RRHH (BR-ADP-006, ADR-KAI-006)
  REGISTER_TRAINING: LEADERSHIP_ROLES, // ADP-10: talleres internos informales (BR-ADP-008), RR.HH.
  // Respuestas 2026-10-20 #17: solo Gerencia General da de alta/desactiva areas (por permiso, nunca por nombre de persona).
  MANAGE_AREAS: new Set(['GERENCIA']),
  // Respuestas 2026-10-20 #19: el sueldo base de la ficha solo lo edita Gerencia; el resto de la ficha, MANAGE_EMPLOYEES.
  MANAGE_SALARY: new Set(['GERENCIA']),
  // Respuestas 2026-10-22 #9 (asistencia con autoservicio): el colaborador con ficha vinculada marca desde su cuenta
  // (`POST /me/attendance`). v0 = todos los roles de colaborador (PLATFORM_ADMIN es administrador, no colaborador).
  LOG_OWN_ATTENDANCE: new Set(['GERENCIA', 'RRHH', 'ADMINISTRACION', 'FINANZAS', 'AUDITORIA', 'CAMPO', 'FRONT_OFFICE']),
  // #9: aprobar o corregir las marcas fuera de la geocerca de la sede.
  REVIEW_ATTENDANCE: new Set(['GERENCIA', 'ADMINISTRACION']),
  // #9: configurar coordenadas y radio de la geocerca por sede.
  MANAGE_GEOFENCE: new Set(['GERENCIA', 'ADMINISTRACION']),
  // HU-35: el DNI/documento del colaborador es dato personal sensible; AUDITORIA y FINANZAS no lo ven salvo que la matriz lo conceda.
  VIEW_EMPLOYEE_DOCUMENT: new Set(['GERENCIA', 'RRHH', 'ADMINISTRACION']),
};

export function isHrAdministrationRoleAllowed(role: WorkerRole, action: HrAdministrationAction): boolean {
  return HR_ADMINISTRATION_ROLE_POLICY[action]?.has(role) ?? false;
}

export function assertHrAdministrationRoleAllowed(role: WorkerRole, action: HrAdministrationAction): void {
  if (!isHrAdministrationRoleAllowed(role, action)) {
    throw new ForbiddenException({
      code: 'ROLE_NOT_ALLOWED',
      detail: `El rol ${role} no tiene permiso para realizar la acción ${action} sobre Administración de Personal.`,
    });
  }
}
