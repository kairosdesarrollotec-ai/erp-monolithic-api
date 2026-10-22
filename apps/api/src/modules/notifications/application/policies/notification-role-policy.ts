import type { WorkerRole } from '../../../users/domain/worker-role';

/**
 * Politica rol-accion de Notificaciones (deny-by-default), version 0 de la matriz ADM-02. Solo SIEMBRA la matriz
 * (`buildDefaultRolePermissionMatrix`); el enforcement real es por permiso sobre la matriz versionada.
 *
 * NOTIFICATIONS.RECEIVE_RETURN_ALERTS (Respuestas 2026-10-20 #8): las alertas del tablero de devolucion (garantia 24 h,
 * cargo por retraso, inmovilizacion) se dirigen a quien tenga este permiso, ya no a un rol fijo. v0 = Finanzas,
 * Administracion y Gerencia (+ PLATFORM_ADMIN); el resto de roles lo recibe solo si ADM-02 se lo concede.
 */
export type NotificationAction = 'RECEIVE_RETURN_ALERTS' | 'RECEIVE_FIELD_TRIP_ALERTS' | 'RECEIVE_HR_ALERTS';

const RETURN_ALERT_ROLES: ReadonlySet<WorkerRole> = new Set(['FINANZAS', 'ADMINISTRACION', 'GERENCIA', 'PLATFORM_ADMIN']);

/**
 * Respuestas 2026-10-22 #4 (Russbel): las alertas de la cascada de salidas a campo (solicitud creada, escalada de nivel, nadie
 * autorizo) y las de Talento Humano (terminacion laboral, vacante creada, paso a planilla) las recibe Gerencia General. Son
 * permisos EDITABLES en ADM-02: v0 = Gerencia (+ PLATFORM_ADMIN); el resto de roles los recibe solo si la matriz se los concede.
 */
const FIELD_TRIP_ALERT_ROLES: ReadonlySet<WorkerRole> = new Set(['GERENCIA', 'PLATFORM_ADMIN']);
const HR_ALERT_ROLES: ReadonlySet<WorkerRole> = new Set(['GERENCIA', 'PLATFORM_ADMIN']);

const NOTIFICATION_ROLE_POLICY: Readonly<Record<NotificationAction, ReadonlySet<WorkerRole>>> = {
  RECEIVE_RETURN_ALERTS: RETURN_ALERT_ROLES,
  RECEIVE_FIELD_TRIP_ALERTS: FIELD_TRIP_ALERT_ROLES,
  RECEIVE_HR_ALERTS: HR_ALERT_ROLES,
};

export function isNotificationRoleAllowed(role: WorkerRole, action: NotificationAction): boolean {
  return NOTIFICATION_ROLE_POLICY[action]?.has(role) ?? false;
}
