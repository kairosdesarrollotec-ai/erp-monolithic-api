export interface AuditEventRecord {
  id: string;
  organizationId: string;
  actorUserId: string | null;
  entityType: string;
  entityId: string;
  action: string;
  changes: Record<string, unknown> | null;
  createdAt: Date;
}

export interface ListAuditEventsFilter {
  organizationId: string;
  actorUserId?: string;
  entityType?: string;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
}

/**
 * Puerto de LECTURA de audit_events (ADM-04, PANTALLAS-V2-B-SOPORTE.md).
 * Separado de AuditEventRepositoryPort (que es solo de escritura, ver su
 * propio comentario de clase) para no mezclar los dos usos - todos los
 * modulos escriben ahi, pero solo Administracion/Auditoria pueden leerlo
 * (assertAdminRoleAllowed(..., 'VIEW_AUDIT') en el handler de ADM-04).
 */
export abstract class AuditEventQueryPort {
  abstract listEvents(filter: ListAuditEventsFilter): Promise<AuditEventRecord[]>;
}
