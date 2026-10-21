import { Injectable } from '@nestjs/common';
import { ClockPort } from '../../../../common/application/ports/clock.port';
import { ReturnDashboardAlertPort } from '../ports/return-dashboard-alert.port';
import { ReturnAlertRecipientScope, ReturnAlertRecipientsPort } from '../ports/return-alert-recipients.port';
import type { WorkerRole } from '../../../users/domain/worker-role';
import {
  WARRANTY_RELEASE_WARNING_LEAD_HOURS,
  WARRANTY_RELEASE_WINDOW_HOURS,
  computeWarrantyReleaseAlert,
} from '../../domain/return-alerts';
import { ReturnDashboardItemInput, buildWarrantyDashboardItem, parseWarrantyDashboardLevel } from '../../domain/return-dashboard-alerts';

export interface PublishReturnDashboardAlertsResult {
  candidates: number;
  created: number;
  dismissed: number;
}

/** Tamaño de página y tope de páginas por ciclo (el resto se atiende en el ciclo siguiente). */
export const DASHBOARD_ALERT_PAGE_SIZE = 200;
export const DASHBOARD_ALERT_MAX_PAGES = 10;

const HOUR_MS = 60 * 60 * 1000;

/**
 * DEC-DEVREM-002 - Proceso del sistema (sin usuario): proyecta al tablero (dashboard_items, ALERT) de los roles con el permiso
 * NOTIFICATIONS.RECEIVE_RETURN_ALERTS (Respuestas 2026-10-20 #8; ya no solo Finanzas) la alerta
 * de garantía de 24 h (BR-DEV-001, SC-DEV-001.02): un item por devolución y nivel (DUE_SOON a ≤ 4 h del límite; OVERDUE al
 * vencer). Después reconcilia: descarta (dismissed_at, sin borrar) los items cuyo expediente ya no está en alerta (liberó la
 * garantía, tuvo daños, pasó de DUE_SOON a OVERDUE). Idempotente y seguro con varias réplicas (clave natural + índice único
 * con ON CONFLICT DO NOTHING; el descarte es un UPDATE condicionado). SOLO alerta: nunca libera ni reembolsa.
 */
@Injectable()
export class PublishReturnDashboardAlertsHandler {
  constructor(
    private readonly alerts: ReturnDashboardAlertPort,
    private readonly clock: ClockPort,
    private readonly recipients: ReturnAlertRecipientsPort,
  ) {}

  async execute(): Promise<PublishReturnDashboardAlertsResult> {
    const now = this.clock.now();
    // Destinatarios por empresa/sede, resueltos una vez por ciclo (la matriz cambia poco; el siguiente ciclo la relee).
    const recipientCache = new Map<string, Promise<WorkerRole[]>>();
    const rolesFor = (scope: ReturnAlertRecipientScope): Promise<WorkerRole[]> => {
      const key = `${scope.organizationId}:${scope.operatingCompanyId}:${scope.branchId}`;
      let roles = recipientCache.get(key);
      if (!roles) {
        roles = this.recipients.rolesWithAlertPermission(scope);
        recipientCache.set(key, roles);
      }
      return roles;
    };
    // Ninguna devolución puede estar en alerta antes de (24 h - 4 h) desde la recepción.
    const receivedBefore = new Date(now.getTime() - (WARRANTY_RELEASE_WINDOW_HOURS - WARRANTY_RELEASE_WARNING_LEAD_HOURS) * HOUR_MS);

    let candidates = 0;
    let created = 0;
    let afterId: string | undefined;
    for (let page = 0; page < DASHBOARD_ALERT_MAX_PAGES; page += 1) {
      const records = await this.alerts.listWarrantyCandidates(receivedBefore, DASHBOARD_ALERT_PAGE_SIZE, afterId);
      if (records.length === 0) break;
      candidates += records.length;
      const items: ReturnDashboardItemInput[] = [];
      for (const record of records) {
        const alert = computeWarrantyReleaseAlert(record, now);
        if (!alert) continue;
        for (const role of await rolesFor(record)) items.push(buildWarrantyDashboardItem(record, alert, role));
      }
      created += await this.alerts.createDashboardItems(items);
      if (records.length < DASHBOARD_ALERT_PAGE_SIZE) break;
      afterId = records[records.length - 1].id;
    }

    const dismissed = await this.reconcile(now, rolesFor);
    return { candidates, created, dismissed };
  }

  private async reconcile(now: Date, rolesFor: (scope: ReturnAlertRecipientScope) => Promise<WorkerRole[]>): Promise<number> {
    let dismissed = 0;
    let afterId: string | undefined;
    for (let page = 0; page < DASHBOARD_ALERT_MAX_PAGES; page += 1) {
      const active = await this.alerts.listActiveWarrantyItems(DASHBOARD_ALERT_PAGE_SIZE, afterId);
      if (active.length === 0) break;
      const records = await this.alerts.findReturnsByIds([...new Set(active.map((item) => item.sourceId))]);
      const byId = new Map(records.map((record) => [record.id, record]));
      const stale: string[] = [];
      for (const item of active) {
        const record = byId.get(item.sourceId);
        const current = record ? computeWarrantyReleaseAlert(record, now) : null;
        // Obsoleto: la devolucion ya no esta en alerta / cambio de nivel, o el rol del item ya no tiene el permiso de alertas.
        if (!current || current.level !== parseWarrantyDashboardLevel(item.sourceEventId) || !(await rolesFor(item)).includes(item.role)) {
          stale.push(item.id);
        }
      }
      dismissed += await this.alerts.dismissItems(stale, now);
      if (active.length < DASHBOARD_ALERT_PAGE_SIZE) break;
      afterId = active[active.length - 1].id;
    }
    return dismissed;
  }
}
