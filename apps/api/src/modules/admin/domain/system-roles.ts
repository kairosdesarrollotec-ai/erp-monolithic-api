import type { WorkerRole } from '../../users/domain/worker-role';

/**
 * Roles de sistema (ROLES DINAMICOS, fase 2): los 8 valores historicos del
 * enum WorkerRole se siembran por organizacion como filas de `roles` con
 * `isSystem = true` y `key` estable. `name` es la etiqueta legible vigente
 * (espejo de WORKER_ROLE_LABELS del front); despues de sembrarse el
 * administrador puede renombrarlos (salvo PLATFORM_ADMIN) - la `key` nunca cambia.
 *
 * Esta lista es la MISMA que inserta la migracion 20261007000000_dynamic_roles
 * y la que usa `ensureSystemRoles` para organizaciones nuevas.
 */
export interface SystemRoleDefinition {
  key: WorkerRole;
  name: string;
}

export const SYSTEM_ROLE_DEFINITIONS: readonly SystemRoleDefinition[] = [
  { key: 'ADMINISTRACION', name: 'Administración' },
  { key: 'AUDITORIA', name: 'Auditoría' },
  { key: 'CAMPO', name: 'Campo' },
  { key: 'FINANZAS', name: 'Finanzas' },
  { key: 'FRONT_OFFICE', name: 'Front Office' },
  { key: 'GERENCIA', name: 'Gerencia' },
  { key: 'PLATFORM_ADMIN', name: 'Administrador de Plataforma' },
  { key: 'RRHH', name: 'RR. HH.' },
];

/**
 * PLATFORM_ADMIN (SDD: nunca delegable): no se renombra, no se desactiva y su
 * fila de la matriz NO es editable desde ADM-02 - guardar una matriz nunca
 * puede quitarle permisos (se fuerza allowed = true en todo el catalogo).
 * Ya no existe ningun atajo `role === 'PLATFORM_ADMIN'` en la autorizacion:
 * sus permisos son filas sembradas, como las de cualquier otro rol.
 */
export const PLATFORM_ADMIN_KEY: WorkerRole = 'PLATFORM_ADMIN';
