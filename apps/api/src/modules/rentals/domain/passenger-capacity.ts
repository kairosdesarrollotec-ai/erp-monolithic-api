import { CompanionPassengerCapacityExceededError } from './rental-errors';

/**
 * Respuesta de Fiorella (16-oct-2026): maximo de acompanantes = capacidad de pasajeros del vehiculo.
 * DEC-FLT-CAP-002: `Vehicle.passengerCapacity` es obligatoria al registrar un vehiculo nuevo (G-05), pero los
 * vehiculos anteriores pueden tenerla NULL. Con capacidad null/undefined NO hay tope: el limite no se valida
 * (comportamiento explicito y cubierto por pruebas) hasta que Flota complete el dato.
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
