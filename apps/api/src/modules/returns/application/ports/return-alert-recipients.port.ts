import type { WorkerRole } from '../../../users/domain/worker-role';

export interface ReturnAlertRecipientScope {
  organizationId: string;
  operatingCompanyId: string;
  branchId: string;
}

/**
 * Respuestas de negocio 2026-10-20 #8 - destinatarios de las alertas de devolucion del tablero: los roles que tienen el permiso
 * NOTIFICATIONS.RECEIVE_RETURN_ALERTS (matriz ADM-02, ambito empresa/sede de la devolucion). El tablero proyecta por clave de rol
 * de sistema (`dashboard_items.role`), por lo que un rol creado a mano (key = null) aun no puede ser destinatario.
 */
export abstract class ReturnAlertRecipientsPort {
  abstract rolesWithAlertPermission(scope: ReturnAlertRecipientScope): Promise<WorkerRole[]>;
}
