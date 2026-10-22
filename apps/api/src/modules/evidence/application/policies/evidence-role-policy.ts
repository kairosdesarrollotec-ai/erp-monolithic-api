import type { WorkerRole } from '../../../users/domain/worker-role';

/**
 * Politica rol-accion de Evidencia (deny-by-default), version 0 de la matriz ADM-02. Solo SIEMBRA la matriz
 * (`buildDefaultRolePermissionMatrix`); el enforcement real es por permiso sobre la matriz versionada.
 *
 * DEC-EVID-DELETE-002 (Respuestas 2026-10-20 #35, SDD §15.5): eliminar evidencia exige DOBLE APROBACION.
 *  - REQUEST_DELETION: abrir una solicitud de eliminacion (motivo obligatorio). v0 = Gerencia y Administracion (+ PLATFORM_ADMIN).
 *  - APPROVE_DELETION: aprobar / rechazar una solicitud (el solicitante nunca; el segundo aprobador, distinto del primero). Mismos roles v0.
 *  - DELETE_DIRECT: el DELETE directo historico (DEC-EVID-DELETE-001), DEPRECADO: solo PLATFORM_ADMIN.
 */
export type EvidenceAction = 'REQUEST_DELETION' | 'APPROVE_DELETION' | 'DELETE_DIRECT';

const DELETION_FLOW_ROLES: ReadonlySet<WorkerRole> = new Set(['GERENCIA', 'ADMINISTRACION', 'PLATFORM_ADMIN']);

const EVIDENCE_ROLE_POLICY: Readonly<Record<EvidenceAction, ReadonlySet<WorkerRole>>> = {
  REQUEST_DELETION: DELETION_FLOW_ROLES,
  APPROVE_DELETION: DELETION_FLOW_ROLES,
  DELETE_DIRECT: new Set<WorkerRole>(['PLATFORM_ADMIN']),
};

export function isEvidenceRoleAllowed(role: WorkerRole, action: EvidenceAction): boolean {
  return EVIDENCE_ROLE_POLICY[action]?.has(role) ?? false;
}
