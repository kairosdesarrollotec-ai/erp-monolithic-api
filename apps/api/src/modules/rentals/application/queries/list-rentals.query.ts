import { RentalStatus } from '../../domain/rental-status';

export class ListRentalsQuery {
  constructor(
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly status?: RentalStatus,
    public readonly limit: number = 20,
    public readonly cursor?: { createdAt: Date; id: string },
  ) {}
}
