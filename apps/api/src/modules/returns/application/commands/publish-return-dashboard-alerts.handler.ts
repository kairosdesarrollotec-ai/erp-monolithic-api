import { Injectable } from '@nestjs/common';
import { ClockPort } from '../../../../common/application/ports/clock.port';
import { ReturnDashboardAlertPort } from '../ports/return-dashboard-alert.port';
import { ReturnAlertRecipientScope, ReturnAlertRecipientsPort } from '../ports/return-alert-recipients.port';
import type { WorkerRole } from '../../../users/domain/worker-role';
import {
  WARRANTY_RELEASE_WARNING_LEAD_HOURS,
  WARRANTY_RELEASE_WINDOW_HOURS,
  IMMOBILIZATION_ALERT_AFTER_HOURS,
  computeImmobilizationAlert,
  computeLateChargeSuggestion,
  computeWarrantyReleaseAlert,
} from '../../domain/return-alerts';
import {
  IMMOBILIZATION_DASHBOARD_KEY_PREFIX,
  LATE_CHARGE_DASHBOARD_KEY_PREFIX,
  ReturnDashboardItemInput,
  buildImmobilizationDashboardItem,
  buildLateChargeDashboardItem,
  buildWarrantyDashboardItem,
  parseWarrantyDashboardLevel,
} from '../../domain/return-dashboard-alerts';
import type { ReturnRecord } from '../ports/return-repository.port';

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
 *
 * P3 (21-oct-2026): con el mismo mecanismo y destinatarios proyecta tambien la sugerencia de CARGO POR RETRASO (LATE_CHARGE)
 * y la alerta de INMOVILIZACION > 24 h por dano tecnico (IMMOBILIZATION). Ambas son solo aviso: el cobro es manual. Se
 * descartan al resolverse (cargo registrado / dias cobrados / ya no aplica) o si el rol pierde el permiso.
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

    const lateCharge = await this.publishPaged(
      (afterId) => this.alerts.listLateChargeCandidates(now, DASHBOARD_ALERT_PAGE_SIZE, afterId),
      (record, role) => {
        const suggestion = computeLateChargeSuggestion(record, now);
        return suggestion ? buildLateChargeDashboardItem(record, suggestion, role) : null;
      },
      rolesFor,
    );
    const immobilization = await this.publishPaged(
      (afterId) =>
        this.alerts.listImmobilizationCandidates(new Date(now.getTime() - IMMOBILIZATION_ALERT_AFTER_HOURS * HOUR_MS), DASHBOARD_ALERT_PAGE_SIZE, afterId),
      (record, role) => {
        const alert = computeImmobilizationAlert(record, now);
        return alert ? buildImmobilizationDashboardItem(record, alert, role) : null;
      },
      rolesFor,
    );
    candidates += lateCharge.candidates + immobilization.candidates;
    created += lateCharge.created + immobilization.created;

    const dismissed = await this.reconcile(now, rolesFor);
    return { candidates, created, dismissed };
  }

  /** Recorre candidatas paginadas por id y crea (idempotente) un item por rol destinatario cuando la regla de dominio aplica. */
  private async publishPaged(
    fetch: (afterId?: string) => Promise<ReturnRecord[]>,
    build: (record: ReturnRecord, role: WorkerRole) => ReturnDashboardItemInput | null,
    rolesFor: (scope: ReturnAlertRecipientScope) => Promise<WorkerRole[]>,
  ): Promise<{ candidates: number; created: number }> {
    let candidates = 0;
    let created = 0;
    let afterId: string | undefined;
    for (let page = 0; page < DASHBOARD_ALERT_MAX_PAGES; page += 1) {
      const records = await fetch(afterId);
      if (records.length === 0) break;
      candidates += records.length;
      const items: ReturnDashboardItemInput[] = [];
      for (const record of records) {
        for (const role of await rolesFor(record)) {
          const item = build(record, role);
          if (item) items.push(item);
        }
      }
      if (items.length > 0) created += await this.alerts.createDashboardItems(items);
      if (records.length < DASHBOARD_ALERT_PAGE_SIZE) break;
      afterId = records[records.length - 1].id;
    }
    return { candidates, created };
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
    dismissed += await this.reconcileKind(LATE_CHARGE_DASHBOARD_KEY_PREFIX, rolesFor, now, (record) => computeLateChargeSuggestion(record, now) !== null);
    dismissed += await this.reconcileKind(IMMOBILIZATION_DASHBOARD_KEY_PREFIX, rolesFor, now, (record) => computeImmobilizationAlert(record, now) !== null);
    return dismissed;
  }

  /** Descarta los items activos de una familia cuya regla ya no aplica (resuelta / cambio de estado) o cuyo rol perdio el permiso. */
  private async reconcileKind(
    prefix: string,
    rolesFor: (scope: ReturnAlertRecipientScope) => Promise<WorkerRole[]>,
    now: Date,
    stillApplies: (record: ReturnRecord) => boolean,
  ): Promise<number> {
    let dismissed = 0;
    let afterId: string | undefined;
    for (let page = 0; page < DASHBOARD_ALERT_MAX_PAGES; page += 1) {
      const active = await this.alerts.listActiveItems(`${prefix}:`, DASHBOARD_ALERT_PAGE_SIZE, afterId);
      if (active.length === 0) break;
      const records = await this.alerts.findReturnsByIds([...new Set(active.map((item) => item.sourceId))]);
      const byId = new Map(records.map((record) => [record.id, record]));
      const stale: string[] = [];
      for (const item of active) {
        const record = byId.get(item.sourceId);
        if (!record || !stillApplies(record) || !(await rolesFor(item)).includes(item.role)) stale.push(item.id);
      }
      dismissed += await this.alerts.dismissItems(stale, now);
      if (active.length < DASHBOARD_ALERT_PAGE_SIZE) break;
      afterId = active[active.length - 1].id;
    }
    return dismissed;
  }
}
