import type {
  MatrixScope,
  RolePermissionEntry,
  RolePermissionMatrixSnapshot,
} from '../application/ports/role-permission-matrix.port';
import { actionKey, PERMISSION_ACTION_CATALOG, type PermissionModule } from './permission-action-catalog';

/**
 * Resolucion de permisos sobre la matriz con ambito (funciones puras,
 * compartidas por MatrixAuthorizationService, GET /me/permissions y la
 * proteccion del ultimo administrador).
 *
 * Reglas:
 *   - gana el ambito mas especifico (sede > empresa > organizacion) QUE TENGA
 *     una entrada para (rol, modulo, accion): una foto guardada es completa
 *     para los roles que existian al guardarla; un rol creado despues no
 *     tiene entrada en ella y se resuelve en la capa de arriba;
 *   - sin entrada en ninguna capa = DENEGADO (deny-by-default).
 */

export function scopeKey(scope: MatrixScope): string {
  return `${scope.companyId ?? '*'}:${scope.branchId ?? '*'}`;
}

/** Capas que aplican a un contexto (empresa, sede), de la mas especifica a la menos. */
export function layersForContext(
  snapshots: readonly RolePermissionMatrixSnapshot[],
  context: { companyId: string; branchId: string | null } | null,
): RolePermissionMatrixSnapshot[] {
  const byScope = new Map(snapshots.map((snapshot) => [scopeKey(snapshot.scope), snapshot]));
  const layers: RolePermissionMatrixSnapshot[] = [];
  if (context) {
    if (context.branchId) {
      const branchLayer = byScope.get(scopeKey({ companyId: context.companyId, branchId: context.branchId }));
      if (branchLayer) layers.push(branchLayer);
    }
    const companyLayer = byScope.get(scopeKey({ companyId: context.companyId, branchId: null }));
    if (companyLayer) layers.push(companyLayer);
  }
  const organizationLayer = byScope.get(scopeKey({ companyId: null, branchId: null }));
  if (organizationLayer) layers.push(organizationLayer);
  return layers;
}

export function findEntry(
  layers: readonly RolePermissionMatrixSnapshot[],
  roleId: string,
  module: PermissionModule,
  action: string,
): { entry: RolePermissionEntry; layer: RolePermissionMatrixSnapshot } | undefined {
  for (const layer of layers) {
    const entry = layer.entries.find(
      (candidate) => candidate.roleId === roleId && candidate.module === module && candidate.action === action,
    );
    if (entry) return { entry, layer };
  }
  return undefined;
}

export function isAllowedByLayers(
  layers: readonly RolePermissionMatrixSnapshot[],
  roleId: string,
  module: PermissionModule,
  action: string,
): boolean {
  return findEntry(layers, roleId, module, action)?.entry.allowed ?? false;
}

/** Permisos efectivos (solo los permitidos) de un rol, en el orden del catalogo. */
export function effectivePermissionsOf(
  layers: readonly RolePermissionMatrixSnapshot[],
  roleId: string,
): { module: PermissionModule; action: string }[] {
  return PERMISSION_ACTION_CATALOG.filter((descriptor) =>
    isAllowedByLayers(layers, roleId, descriptor.module, descriptor.action),
  ).map((descriptor) => ({ module: descriptor.module, action: descriptor.action }));
}

/** `matrixVersion` de /me/permissions: cambia cuando cambia cualquier capa consultada (versiones crecientes por organizacion). */
export function matrixVersionOf(layers: readonly RolePermissionMatrixSnapshot[]): number {
  return layers.reduce((max, layer) => Math.max(max, layer.version), 0);
}

/** Acciones que definen a un "administrador" para las salvaguardas (nadie queda sin poder gestionar permisos ni usuarios). */
export const ADMINISTRATOR_ACTIONS: readonly { module: PermissionModule; action: string }[] = [
  { module: 'ADMIN', action: 'MANAGE_PERMISSIONS' },
  { module: 'ADMIN', action: 'MANAGE_USERS' },
];

export function hasAdministratorPermissions(layers: readonly RolePermissionMatrixSnapshot[], roleId: string): boolean {
  return ADMINISTRATOR_ACTIONS.every((required) => isAllowedByLayers(layers, roleId, required.module, required.action));
}

export { actionKey };
