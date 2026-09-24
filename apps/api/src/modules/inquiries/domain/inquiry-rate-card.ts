import type { RateCardVersion } from '../application/ports/rate-card.port';

/**
 * PROVISIONAL (PROP-007): unico tarifario fijo en codigo, versionado por
 * convencion en su identificador. Solo lo consume
 * `ProvisionalRateCardAdapter` (via `RateCardPort`) - ningun handler lo
 * importa directamente. Se reemplaza por una tabla de tarifario versionada
 * cuando el negocio la defina.
 */
export const CURRENT_RATE_CARD: RateCardVersion = {
  version: 'RATE-CARD-2026-09',
  amountPerDay: '120.00',
  currency: 'PEN',
  validityHours: 72,
};
