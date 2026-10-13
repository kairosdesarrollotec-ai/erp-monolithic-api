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
  rejectedById?: string | null;
  rejectedByName?: string | null;
  rejectedAt?: Date | null;
  rejectedAtLevel?: number | null;
  rejectionReason?: string | null;
}

export interface ListFieldTripsFilters {
  companyId: string;
  branchId?: string;
  status?: FieldTripStatus;
  employeeId?: string;
  limit?: number;
}

export interface FieldTripWithEmployee extends FieldTripRequest {
  /** Datos mínimos del colaborador (los necesarios para evaluar el retorno sin exigir VIEW_EMPLOYEES). */
  employee: {
    id: string;
    fullName: string;
    areaName: string;
    jobTitle: string;
    fieldTripLateCount: number;
    isFieldTripObserved: boolean;
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
   * Reclama (FOR UPDATE SKIP LOCKED, dentro de la transacción `tx`) la siguiente salida pendiente cuyo temporizador
   * de 5 min ya venció. Otra instancia que corra a la vez salta las filas bloqueadas, así que dos réplicas nunca
   * escalan la misma salida. Devuelve null si no hay ninguna vencida.
   */
  abstract claimNextDueForEscalation(now: Date, tx: Prisma.TransactionClient): Promise<string | null>;
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
