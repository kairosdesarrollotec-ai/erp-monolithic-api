import type { WorkerRole } from '../../../users/domain/worker-role';
import type { NotificationAction } from '../policies/notification-role-policy';

export interface AlertRecipientScope {
  organizationId: string;
  operatingCompanyId: string;
  branchId: string;
}

/**
 * Respuestas 2026-10-22 #4 - destinatarios de las alertas del tablero (TR-06) por PERMISO de notificacion editable en ADM-02
 * (NOTIFICATIONS.RECEIVE_FIELD_TRIP_ALERTS / RECEIVE_HR_ALERTS ...), no por rol fijo. Devuelve las claves de los roles de sistema
 * que tienen el permiso en la empresa/sede (el tablero proyecta por `dashboard_items.role`, asi que un rol creado a mano, sin
 * clave, aun no puede ser destinatario; mismo limite que RECEIVE_RETURN_ALERTS).
 */
export abstract class AlertRecipientsPort {
  abstract rolesWithPermission(scope: AlertRecipientScope, action: NotificationAction): Promise<WorkerRole[]>;
}
