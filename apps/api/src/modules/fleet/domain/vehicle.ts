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
  photoUrl?: string | null;
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
