import { CompanionPassengerCapacityExceededError } from './rental-errors';

/**
 * Respuesta de Fiorella (16-oct-2026): maximo de acompanantes = capacidad de pasajeros del vehiculo.
 * TODO(DEC-ALQ-CAPACITY-009): `vehicles` aun NO tiene capacidad/asientos (Flota debe agregar la columna y
 * exponerla en `RentalRecord.vehiclePassengerCapacity`). Mientras sea null/undefined el limite NO se valida.
 */
export function assertCompanionWithinCapacity(
  passengerCapacity: number | null | undefined,
  currentCompanions: number,
): void {
  if (passengerCapacity == null) return;
  if (currentCompanions + 1 > passengerCapacity) {
    throw new CompanionPassengerCapacityExceededError(passengerCapacity);
  }
}
