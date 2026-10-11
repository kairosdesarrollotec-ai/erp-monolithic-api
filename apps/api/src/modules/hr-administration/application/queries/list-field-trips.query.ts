import type { FieldTripStatus } from '@prisma/client';

export class ListFieldTripsQuery {
  constructor(
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly status?: FieldTripStatus,
    public readonly employeeId?: string,
  ) {}
}
