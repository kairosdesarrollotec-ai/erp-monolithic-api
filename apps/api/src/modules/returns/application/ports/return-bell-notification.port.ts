import type { WorkerRole } from '../../../users/domain/worker-role';

export interface ReturnBellNotificationInput {
  organizationId: string;
  operatingCompanyId: string;
  branchId: string;
  /** Roles de sistema destinatarios; se notifica a cada usuario con una asignación vigente a ese rol en la empresa/sede. */
  roles: readonly WorkerRole[];
  notificationType: string;
  title: string;
  deepLink: string;
  /** Prefijo de la clave natural; la fila final es `${sourceEventPrefix}:${firebaseUid}` (idempotente por destinatario). */
  sourceEventPrefix: string;
  isEscalated?: boolean;
}

/**
 * H-02 (pruebas manuales 28-oct, decisión #4): NO_CONFORME y la derivación a Gerencia por alcolímetro desfavorable llegan a
 * la campana (notifications_read_model) de cada usuario con el rol destinatario, además del tablero. Idempotente.
 */
export abstract class ReturnBellNotificationPort {
  /** Devuelve las filas realmente creadas. */
  abstract notifyRoles(input: ReturnBellNotificationInput): Promise<number>;
}
