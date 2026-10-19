import { Injectable } from '@nestjs/common';
import { ClockPort } from '../../../../common/application/ports/clock.port';
import { ReturnAlertRepositoryPort } from '../ports/return-alert-repository.port';
import { ReturnAccessService } from '../services/return-access.service';
import {
  IMMOBILIZATION_ALERT_AFTER_HOURS,
  ImmobilizationAlert,
  WARRANTY_RELEASE_WARNING_LEAD_HOURS,
  WARRANTY_RELEASE_WINDOW_HOURS,
  LateChargeSuggestion,
  WarrantyReleaseAlert,
  computeImmobilizationAlert,
  computeLateChargeSuggestion,
  computeWarrantyReleaseAlert,
} from '../../domain/return-alerts';
import { ListReturnAlertsQuery, ReturnAlertType } from './list-return-alerts.query';

export interface ReturnAlertItem {
  type: ReturnAlertType;
  returnId: string;
  rentalId: string;
  returnStatus: string;
  returnVersion: number;
  vehiclePlate: string | null;
  customerName: string | null;
  receivedAt: Date;
  warrantyRelease: WarrantyReleaseAlert | null;
  immobilization: ImmobilizationAlert | null;
  /** Presente cuando type = LATE_CHARGE (DEC-DEVREM-003): sugerencia de registrar el cargo por retraso; sin monto. */
  lateCharge: LateChargeSuggestion | null;
}

/**
 * DEV-08 / DEV-07 - Alertas operativas de devolución, calculadas con el reloj al consultar (sin estado propio):
 *  - WARRANTY_RELEASE: garantía de una devolución SIN_DANOS próxima a vencer / vencida el plazo máximo de 24 h (BR-DEV-001).
 *  - IMMOBILIZATION: > 24 h naturales de inmovilización por daño técnico sin cobrar (BR-DEV-011).
 *  - LATE_CHARGE: devolución recibida con retraso mayor que la tolerancia de 30 min y sin cargo por retraso registrado: el
 *    sistema SUGIERE registrarlo (DEC-DEVREM-003; el monto lo digita el usuario autorizado, F-03: sin cálculo automático).
 * Solo alertan: ni el reembolso ni el cobro se ejecutan automáticamente.
 */
@Injectable()
export class ListReturnAlertsHandler {
  constructor(
    private readonly access: ReturnAccessService,
    private readonly alerts: ReturnAlertRepositoryPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(query: ListReturnAlertsQuery): Promise<ReturnAlertItem[]> {
    const { scope } = await this.access.authorize(query, 'READ');
    const now = this.clock.now();

    const wantWarranty = !query.type || query.type === 'WARRANTY_RELEASE';
    const wantImmobilization = !query.type || query.type === 'IMMOBILIZATION';
    const wantLateCharge = !query.type || query.type === 'LATE_CHARGE';
    // Ninguna alerta de reloj puede existir antes de este umbral de horas desde la recepción.
    const earliestHours = Math.min(
      wantWarranty ? WARRANTY_RELEASE_WINDOW_HOURS - WARRANTY_RELEASE_WARNING_LEAD_HOURS : Infinity,
      wantImmobilization ? IMMOBILIZATION_ALERT_AFTER_HOURS : Infinity,
    );
    const candidates = await this.alerts.listCandidates({
      ...scope,
      receivedBefore: Number.isFinite(earliestHours) ? new Date(now.getTime() - earliestHours * 60 * 60 * 1000) : null,
      includeLateCharge: wantLateCharge,
      limit: query.limit,
    });

    const items: ReturnAlertItem[] = [];
    for (const record of candidates) {
      if (!record.receivedAt) continue;
      const base = {
        returnId: record.id,
        rentalId: record.rentalId,
        returnStatus: record.status,
        returnVersion: record.version,
        vehiclePlate: record.vehiclePlate,
        customerName: record.customerName,
        receivedAt: record.receivedAt,
      };
      const warrantyRelease = wantWarranty ? computeWarrantyReleaseAlert(record, now) : null;
      if (warrantyRelease) {
        items.push({ type: 'WARRANTY_RELEASE', ...base, warrantyRelease, immobilization: null, lateCharge: null });
      }
      const immobilization = wantImmobilization ? computeImmobilizationAlert(record, now) : null;
      if (immobilization) {
        items.push({ type: 'IMMOBILIZATION', ...base, warrantyRelease: null, immobilization, lateCharge: null });
      }
      const lateCharge = wantLateCharge ? computeLateChargeSuggestion(record, now) : null;
      if (lateCharge) {
        items.push({ type: 'LATE_CHARGE', ...base, warrantyRelease: null, immobilization: null, lateCharge });
      }
    }
    return items;
  }
}
