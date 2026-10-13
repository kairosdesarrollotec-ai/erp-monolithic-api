import type { SaleDecision } from '../../domain/reservation-sale-resolution';

export class ResolveVehicleSaleCommand {
  constructor(
    public readonly id: string,
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly expectedVersion: number,
    public readonly decision: SaleDecision,
    public readonly alternativeVehicleId?: string,
    public readonly note?: string,
  ) {}
}
