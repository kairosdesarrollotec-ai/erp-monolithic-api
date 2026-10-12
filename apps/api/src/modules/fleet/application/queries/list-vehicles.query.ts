import { VehicleStatus } from '../../domain/vehicle';

export class ListVehiclesQuery {
  constructor(
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly filterBranchId?: string,
    public readonly status?: VehicleStatus,
    public readonly search?: string,
    public readonly limit: number = 50,
    public readonly offset: number = 0,
    /** Ventana opcional [availableFrom, availableTo): ISO date o date-time. Ambos o ninguno. */
    public readonly availableFrom?: string,
    public readonly availableTo?: string,
  ) {}
}
