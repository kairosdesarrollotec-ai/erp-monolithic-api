import type { WorkerRole } from '../../../users/domain/worker-role';

/**
 * Politica rol-accion de Sincronizacion (deny-by-default), version 0 de la matriz ADM-02. Solo SIEMBRA la matriz
 * (`buildDefaultRolePermissionMatrix`); el enforcement real es por permiso sobre la matriz versionada.
 *
 * SYNC.SUPERVISE_CONFLICTS (Respuesta de negocio 2026-10-22): el «supervisor de sincronizacion» que resuelve conflictos de
 * checklists offline (ENTREGA y RECEPCION) es Administracion + Gerencia (+ PLATFORM_ADMIN). Antes se reutilizaban de forma
 * provisional RETURN.CLOSE / RENTAL.MANAGE_CONTRACT_TEMPLATES. Editable en ADM-02.
 */
export type SyncRoleAction = 'SUPERVISE_CONFLICTS';

const SYNC_ROLE_POLICY: Readonly<Record<SyncRoleAction, ReadonlySet<WorkerRole>>> = {
  SUPERVISE_CONFLICTS: new Set<WorkerRole>(['ADMINISTRACION', 'GERENCIA', 'PLATFORM_ADMIN']),
};

export function isSyncRoleAllowed(role: WorkerRole, action: SyncRoleAction): boolean {
  return SYNC_ROLE_POLICY[action]?.has(role) ?? false;
}
