import type { FieldTripRequest, FieldTripStatus, Prisma } from '@prisma/client';

export interface CreateFieldTripData {
  employeeId: string;
  destination: string;
  objective: string;
  estimatedDeparture: Date;
  estimatedReturn: Date;
  level1TimeoutAt: Date;
}

export interface UpdateFieldTripData {
  status?: FieldTripStatus;
  authorizationLevel?: number | null;
  authorizedById?: string | null;
  authorizedByName?: string | null;
  authorizedAt?: Date | null;
  actualDeparture?: Date | null;
  actualReturn?: Date | null;
  lateMinutes?: number;
  returnNotes?: string | null;
  level2TimeoutAt?: Date | null;
  level3TimeoutAt?: Date | null;
}

export interface ListFieldTripsFilters {
  companyId: string;
  branchId?: string;
  status?: FieldTripStatus;
  employeeId?: string;
  limit?: number;
}

export interface FieldTripWithEmployee extends FieldTripRequest {
  employee: {
    fullName: string;
    organizationId: string;
    operatingCompanyId: string;
    branchId: string;
  };
}

export abstract class FieldTripRepositoryPort {
  abstract create(data: CreateFieldTripData, tx?: Prisma.TransactionClient): Promise<FieldTripRequest>;
  abstract findById(id: string, tx?: Prisma.TransactionClient): Promise<FieldTripWithEmployee | null>;
  abstract findMany(filters: ListFieldTripsFilters, tx?: Prisma.TransactionClient): Promise<FieldTripWithEmployee[]>;
  /**
   * Transición condicional (compare-and-set sobre el estado): solo actualiza si la salida sigue en alguno de los
   * estados `from`; si otra operación ya la movió lanza FieldTripNotPendingError / FieldTripNotAuthorizedError.
   */
  abstract transition(
    id: string,
    from: readonly FieldTripStatus[],
    data: UpdateFieldTripData,
    tx?: Prisma.TransactionClient,
  ): Promise<FieldTripRequest>;
}
