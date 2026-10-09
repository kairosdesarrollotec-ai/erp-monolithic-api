import { Injectable } from '@nestjs/common';
import type { FieldTripRequest, FieldTripStatus, Prisma } from '@prisma/client';
import { FieldTripRepositoryPort } from '../ports/field-trip-repository.port';
import { EmployeeRepositoryPort } from '../ports/employee-repository.port';
import {
  FieldTripNotFoundError,
  FieldTripNotAuthorizedError,
  FieldTripTimeoutNotElapsedError,
  NoAuthorizationAvailableError,
} from '../../domain/hr-administration-errors';
import {
  assertAuthorizationLevelReached,
  currentLevelTimeoutAt,
  evaluateReturnOutcome,
  getNextCascadeStatus,
  levelTimeoutFrom,
  validateAuthorizationLevel,
} from '../../domain/hr-administration-rules';

export interface AuthorizeFieldTripInput {
  fieldTripId: string;
  authorizationLevel: number;
  userId: string;
  userName?: string | null;
  now: Date;
}

export interface AdvanceTimeoutInput {
  fieldTripId: string;
  now: Date;
}

export interface EvaluateReturnInput {
  fieldTripId: string;
  actualReturn: Date;
  returnNotes?: string | null;
}

export const PENDING_FIELD_TRIP_STATUSES: readonly FieldTripStatus[] = [
  'PENDIENTE_NIVEL_1',
  'PENDIENTE_NIVEL_2',
  'PENDIENTE_NIVEL_3',
];

/**
 * Cascada de autorización de salidas a campo (BR-ADP-004, DR-ADP-002) y evaluación del retorno (BR-ADP-005).
 * Exactamente 3 niveles con 5 min por nivel. Agotados los 3 el estado es NO_AUTORIZADA: no existe un 4to nivel
 * automático ni aprobación por defecto. Todas las operaciones se ejecutan dentro de la transacción del handler (`tx`).
 */
@Injectable()
export class FieldTripCascadeService {
  constructor(
    private readonly fieldTripRepository: FieldTripRepositoryPort,
    private readonly employeeRepository: EmployeeRepositoryPort,
  ) {}

  /** Autoriza en un nivel ya alcanzado de la cascada (1=Fiorella, 2=José, 3=Cecilia; NUNCA 4). */
  async authorize(input: AuthorizeFieldTripInput, tx?: Prisma.TransactionClient): Promise<FieldTripRequest> {
    validateAuthorizationLevel(input.authorizationLevel);

    const fieldTrip = await this.fieldTripRepository.findById(input.fieldTripId, tx);
    if (!fieldTrip) {
      throw new FieldTripNotFoundError(input.fieldTripId);
    }
    if (fieldTrip.status === 'NO_AUTORIZADA') {
      throw new NoAuthorizationAvailableError(fieldTrip.id);
    }
    assertAuthorizationLevelReached(input.authorizationLevel, fieldTrip.status, fieldTrip.id);

    return this.fieldTripRepository.transition(
      fieldTrip.id,
      PENDING_FIELD_TRIP_STATUSES,
      {
        status: 'AUTORIZADA',
        authorizationLevel: input.authorizationLevel,
        authorizedById: input.userId,
        authorizedByName: input.userName ?? null,
        authorizedAt: input.now,
      },
      tx,
    );
  }

  /**
   * Escala al siguiente nivel cuando venció el temporizador de 5 minutos del nivel actual:
   * N1 -> N2 -> N3 -> NO_AUTORIZADA. Sin 4to nivel automático (el sistema solo notifica y la persona no sale).
   */
  async advanceTimeout(
    input: AdvanceTimeoutInput,
    tx?: Prisma.TransactionClient,
  ): Promise<{ fieldTrip: FieldTripRequest; message?: string }> {
    const fieldTrip = await this.fieldTripRepository.findById(input.fieldTripId, tx);
    if (!fieldTrip) {
      throw new FieldTripNotFoundError(input.fieldTripId);
    }

    const { nextStatus, message } = getNextCascadeStatus(fieldTrip.status, fieldTrip.id);

    const timeoutAt = currentLevelTimeoutAt(fieldTrip);
    if (timeoutAt && input.now.getTime() < timeoutAt.getTime()) {
      throw new FieldTripTimeoutNotElapsedError(fieldTrip.id, timeoutAt);
    }

    const updatePayload: {
      status: FieldTripStatus;
      level2TimeoutAt?: Date;
      level3TimeoutAt?: Date;
    } = { status: nextStatus };

    if (nextStatus === 'PENDIENTE_NIVEL_2') {
      updatePayload.level2TimeoutAt = levelTimeoutFrom(input.now);
    } else if (nextStatus === 'PENDIENTE_NIVEL_3') {
      updatePayload.level3TimeoutAt = levelTimeoutFrom(input.now);
    }

    const updated = await this.fieldTripRepository.transition(fieldTrip.id, [fieldTrip.status], updatePayload, tx);
    return { fieldTrip: updated, message };
  }

  /**
   * Evalúa el retorno de la salida a campo (BR-ADP-005): 1ª a 3ª tardanza = advertencia (CERRADA_NORMAL);
   * desde la 4ª la salida queda OBSERVADA y el colaborador "observado".
   */
  async evaluateReturn(
    input: EvaluateReturnInput,
    tx?: Prisma.TransactionClient,
  ): Promise<{
    fieldTrip: FieldTripRequest;
    isLate: boolean;
    lateMinutes: number;
    newLateCount: number;
    isObserved: boolean;
    message: string;
  }> {
    const fieldTrip = await this.fieldTripRepository.findById(input.fieldTripId, tx);
    if (!fieldTrip) {
      throw new FieldTripNotFoundError(input.fieldTripId);
    }
    if (fieldTrip.status !== 'AUTORIZADA') {
      throw new FieldTripNotAuthorizedError(fieldTrip.id, fieldTrip.status);
    }

    const employee = await this.employeeRepository.findById(fieldTrip.employeeId, tx);
    const currentLateCount = employee?.fieldTripLateCount ?? 0;

    const outcome = evaluateReturnOutcome(currentLateCount, fieldTrip.estimatedReturn, input.actualReturn);

    // La transición condicional gana la carrera: solo un retorno por salida incrementa el contador.
    const updated = await this.fieldTripRepository.transition(
      fieldTrip.id,
      ['AUTORIZADA'],
      {
        status: outcome.status,
        actualReturn: input.actualReturn,
        lateMinutes: outcome.lateMinutes,
        returnNotes: input.returnNotes ?? null,
      },
      tx,
    );

    if (outcome.isLate && employee) {
      await this.employeeRepository.update(
        employee.id,
        { fieldTripLateCount: outcome.newLateCount, isFieldTripObserved: outcome.isObserved },
        tx,
      );
    }

    return {
      fieldTrip: updated,
      isLate: outcome.isLate,
      lateMinutes: outcome.lateMinutes,
      newLateCount: outcome.newLateCount,
      isObserved: outcome.isObserved,
      message: outcome.message,
    };
  }
}
