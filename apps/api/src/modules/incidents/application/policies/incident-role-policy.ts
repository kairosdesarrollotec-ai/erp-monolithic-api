import { ForbiddenException } from '@nestjs/common';
import type { WorkerRole } from '../../../users/domain/worker-role';

/**
 * Politica rol-accion de Incidencias (deny-by-default), version 0 de la matriz ADM-02 - mismo patron que
 * `inquiry-role-policy.ts` (INQUIRY.CONVERT_TO_RENTAL). "Campo" NO es un rol de este modulo: no se crea ningun rol
 * nuevo; el enforcement real es por accion de permiso (INCIDENT.*) sobre la matriz versionada.
 *
 * ROLES DINAMICOS (fase 2): esta politica ya NO decide en runtime; solo SIEMBRA la version 0 de la matriz
 * (`buildDefaultRolePermissionMatrix`, key de rol de sistema -> role_id). PLATFORM_ADMIN no tiene atajo aqui: su
 * "todo permitido" es una fila sembrada.
 *
 * Fuentes: UX/UI v3.1 §5.8 INC-01/INC-02 + incidents.yaml v0.1.0. INC-01 (bandeja: Front-office, Gerencia, Finanzas, Auditoria, Campo);
 * INC-02 (detalle/resolucion: Front-office, Gerencia). Registrar: Front-office, Gerencia y CAMPO (CAMPO ahora puede VIEW y CREATE).
 * Agregar accion, resolver, cerrar y derivar a via legal: Front-office y Gerencia. Ver: Front-office, Gerencia, Finanzas, Auditoria y Campo.
 */
export type IncidentAction = 'VIEW' | 'CREATE' | 'ADD_ACTION' | 'RESOLVE' | 'CLOSE' | 'REFER_LEGAL';

const WRITE_ROLES: ReadonlySet<WorkerRole> = new Set(['FRONT_OFFICE', 'GERENCIA']);
const CREATE_ROLES: ReadonlySet<WorkerRole> = new Set(['FRONT_OFFICE', 'GERENCIA', 'CAMPO']);
const VIEW_ROLES: ReadonlySet<WorkerRole> = new Set(['FRONT_OFFICE', 'GERENCIA', 'FINANZAS', 'AUDITORIA', 'CAMPO']);

const INCIDENT_ROLE_POLICY: Readonly<Record<IncidentAction, ReadonlySet<WorkerRole>>> = {
  VIEW: VIEW_ROLES,
  CREATE: CREATE_ROLES,
  ADD_ACTION: WRITE_ROLES,
  RESOLVE: WRITE_ROLES,
  CLOSE: WRITE_ROLES,
  REFER_LEGAL: WRITE_ROLES,
};

export function isIncidentRoleAllowed(role: WorkerRole, action: IncidentAction): boolean {
  return INCIDENT_ROLE_POLICY[action]?.has(role) ?? false;
}

export function assertIncidentRoleAllowed(role: WorkerRole, action: IncidentAction): void {
  if (!isIncidentRoleAllowed(role, action)) {
    throw new ForbiddenException({
      code: 'ROLE_NOT_ALLOWED',
      detail: `El rol ${role} no tiene permiso para realizar la accion ${action} sobre una Incidencia.`,
    });
  }
}
