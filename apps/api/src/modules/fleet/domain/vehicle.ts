export type VehicleStatus = 'AVAILABLE' | 'RENTED' | 'MAINTENANCE' | 'OUT_OF_SERVICE';

export interface FleetVehicle {
  id: string;
  organizationId: string;
  operatingCompanyId: string;
  branchId?: string | null;
  plate: string;
  brand: string;
  model: string;
  year?: number | null;
  color?: string | null;
  category?: string | null;
  status: VehicleStatus;
  dailyRate?: number | null;
  depositMinimum?: number | null;
  /** Pasajeros que admite el vehiculo (1..60); tope de acompanantes del alquiler. */
  passengerCapacity?: number | null;
  /** Precio del combustible por unidad (PEN); insumo de la multa por combustible (aun no calculada). */
  fuelPrice?: number | null;
  photoUrl?: string | null;
  /** DEC-ALQ-THIRDPATH-001: vehiculo "de menor costo relativo" elegible para la tercera via notarial. Solo lo edita Gerencia. */
  thirdPathEligible?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Origen de un conflicto de disponibilidad (vehicle_commitments vs reservas no terminales). */
export type VehicleConflictSource = 'COMMITMENT' | 'RESERVATION';

/** Disponibilidad de un vehiculo en una ventana [availableFrom, availableTo). */
export interface VehicleAvailability {
  available: boolean;
  conflictFrom?: Date;
  conflictTo?: Date;
  conflictSource?: VehicleConflictSource;
}

/** Vehiculo del listado; `availability` solo existe cuando se pidio una ventana de fechas. */
export type FleetVehicleWithAvailability = FleetVehicle & { availability?: VehicleAvailability };
