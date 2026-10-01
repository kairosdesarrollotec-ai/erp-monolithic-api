/**
 * TDD-03-alquiler.md seccion 8.1 - 10 estados del ciclo de vida de Alquiler.
 */
export type RentalStatus =
  | 'DRAFT'
  | 'VALIDATION'
  | 'NOTARY_EVALUATION'
  | 'CONTRACTING'
  | 'PENDING_DELIVERY'
  | 'ACTIVE'
  | 'EXTENSION_PENDING'
  | 'RETURN_IN_PROGRESS'
  | 'CLOSED'
  | 'CANCELLED';

export const TERMINAL_RENTAL_STATUSES: ReadonlySet<RentalStatus> = new Set([
  'CLOSED',
  'CANCELLED',
]);

export function isTerminalRentalStatus(status: RentalStatus): boolean {
  return TERMINAL_RENTAL_STATUSES.has(status);
}

/**
 * Validacion de transiciones de estado de la maquina de estados de Alquiler.
 * TDD-03-alquiler.md seccion 8.2
 */
export const ALLOWED_RENTAL_TRANSITIONS: ReadonlyMap<RentalStatus, ReadonlySet<RentalStatus>> = new Map([
  ['DRAFT', new Set<RentalStatus>(['VALIDATION', 'CANCELLED'])],
  ['VALIDATION', new Set<RentalStatus>(['NOTARY_EVALUATION', 'CANCELLED'])],
  ['NOTARY_EVALUATION', new Set<RentalStatus>(['CONTRACTING', 'CANCELLED'])],
  ['CONTRACTING', new Set<RentalStatus>(['PENDING_DELIVERY', 'CANCELLED'])],
  ['PENDING_DELIVERY', new Set<RentalStatus>(['ACTIVE', 'CANCELLED'])],
  ['ACTIVE', new Set<RentalStatus>(['EXTENSION_PENDING', 'RETURN_IN_PROGRESS', 'CLOSED'])],
  ['EXTENSION_PENDING', new Set<RentalStatus>(['ACTIVE'])],
  ['RETURN_IN_PROGRESS', new Set<RentalStatus>(['CLOSED'])],
  ['CLOSED', new Set<RentalStatus>()],
  ['CANCELLED', new Set<RentalStatus>()],
]);

export function canTransitionRental(from: RentalStatus, to: RentalStatus): boolean {
  const allowed = ALLOWED_RENTAL_TRANSITIONS.get(from);
  return allowed ? allowed.has(to) : false;
}
