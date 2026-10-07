import { Injectable } from '@nestjs/common';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { AuditEventQueryPort } from '../../../audit/application/ports/audit-event-query.port';
import { IdentityLookupPort } from '../ports/identity-lookup.port';
import { AdminMatrixAuthorizationService } from '../services/admin-matrix-authorization.service';
import { ListAuditEventsQuery } from './list-audit-events.query';

export interface AuditEventResult {
  id: string;
  actorFirebaseUid: string | null;
  actorEmail: string | null;
  entityType: string;
  entityId: string;
  action: string;
  changes: Record<string, unknown> | null;
  createdAt: string;
}

/**
 * ADM-04 (Auditoria administrativa, PANTALLAS-V2-B-SOPORTE.md) - de
 * SOLO lectura (contrato punto 7: "Ninguna de escritura"). Accesible a
 * Administracion Y Auditoria (VIEW_AUDIT en admin-role-policy.ts, a
 * diferencia de MANAGE_USERS que es solo Administracion).
 *
 * Alcance real, no sobre-declarado: el contrato UX describe columnas
 * "Campo modificado / Valor anterior / Valor nuevo", pero audit_events
 * (TDD-KAIROS-TRANSVERSAL.md 7.3) guarda un `changes: Json` libre por
 * evento, no un diff estructurado campo-a-campo - los eventos ya
 * escritos por Reservas/Consultas/ADM-01 no tienen esa forma. Esta
 * primera version expone `changes` tal cual (el detalle real disponible
 * hoy) en vez de inventar una columna "valor anterior" que la tabla no
 * puede llenar de forma honesta.
 */
@Injectable()
export class ListAuditEventsHandler {
  constructor(
    private readonly workContext: WorkContextAuthorizationService,
    private readonly adminAuthorization: AdminMatrixAuthorizationService,
    private readonly auditEvents: AuditEventQueryPort,
    private readonly identity: IdentityLookupPort,
  ) {}

  async execute(query: ListAuditEventsQuery): Promise<AuditEventResult[]> {
    const context = await this.workContext.authorize({
      firebaseUid: query.actorFirebaseUid,
      companyId: query.companyId,
      branchId: query.branchId,
    });
    await this.adminAuthorization.assertAllowed(context.organizationId, context.roleId, 'VIEW_AUDIT', { companyId: context.companyId, branchId: context.branchId });

    const events = await this.auditEvents.listEvents({
      organizationId: context.organizationId,
      actorUserId: query.filterActorUid,
      entityType: query.entityType,
      dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
      dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
    });
    if (events.length === 0) return [];

    const uniqueActorUids = [...new Set(events.map((event) => event.actorUserId).filter((uid): uid is string => Boolean(uid)))];
    const emailsByUid = uniqueActorUids.length > 0 ? await this.identity.findEmailsByUids(uniqueActorUids) : {};

    return events.map((event) => ({
      id: event.id,
      actorFirebaseUid: event.actorUserId,
      actorEmail: event.actorUserId ? (emailsByUid[event.actorUserId] ?? null) : null,
      entityType: event.entityType,
      entityId: event.entityId,
      action: event.action,
      changes: event.changes,
      createdAt: event.createdAt.toISOString(),
    }));
  }
}
