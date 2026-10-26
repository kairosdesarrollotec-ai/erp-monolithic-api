import { VehicleStatus } from '../../../domain/vehicle';

export interface VehicleAvailabilityResponse {
  available: boolean;
  /** Inicio del compromiso/reserva que choca (ISO 8601). Solo si available = false. */
  conflictFrom?: string;
  /** Fin del compromiso/reserva que choca (ISO 8601). Solo si available = false. */
  conflictTo?: string;
  conflictSource?: 'COMMITMENT' | 'RESERVATION';
}

export interface VehicleResponse {
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
  passengerCapacity?: number | null;
  fuelPrice?: number | null;
  photoUrl?: string | null;
  /** DEC-ALQ-THIRDPATH-001: elegible para la tercera via notarial (solo Gerencia lo cambia). */
  thirdPathEligible: boolean;
  suitableForTrocha?: boolean;
  rateNormal?: number | null;
  ratePlus?: number | null;
  rateLibre?: number | null;
  fuelPenaltyPerLine?: number | null;
  createdAt: string;
  updatedAt: string;
  /** Solo presente en GET /fleet/vehicles cuando se envian availableFrom y availableTo. */
  availability?: VehicleAvailabilityResponse;
}

export interface ListVehiclesResponse {
  items: VehicleResponse[];
  total: number;
}
