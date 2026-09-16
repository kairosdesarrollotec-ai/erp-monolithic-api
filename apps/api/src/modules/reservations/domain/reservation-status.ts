/**
 * TDD-RES-001.md seccion 8.1 - 5 estados reales (corregido 31 ago 2026:
 * no existe PENDING_PAYMENT ni EXPIRED, no hay bloqueo provisional).
 */
export type ReservationStatus =
  | 'DRAFT'
  | 'CONFIRMED'
  | 'PENDING_SALE_RESOLUTION'
  | 'CONVERTED'
  | 'CANCELLED';
