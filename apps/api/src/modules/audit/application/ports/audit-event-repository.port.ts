import type { Prisma } from '@prisma/client';

export interface RecordLoginAttemptInput {
  organizationId: string | null;
  actorUserId: string | null;
  email: string;
  outcome: 'SUCCESS' | 'FAILURE';
  reason: string | null;
}

export interface RecordWorkContextSelectionInput {
  organizationId: string;
  firebaseUid: string;
  companyId: string;
  branchId: string;
}

export interface RecordReservationEventInput {
  organizationId: string;
  actorUserId: string;
  reservationId: string;
  action: string;
  changes: Record<string, unknown>;
}

export interface RecordAdminEventInput {
  organizationId: string;
  actorUserId: string;
  targetFirebaseUid: string;
  action: string;
  changes: Record<string, unknown>;
}

export interface RecordInquiryEventInput {
  organizationId: string;
  actorUserId: string;
  inquiryId: string;
  action: string;
  changes: Record<string, unknown>;
}

export interface RecordRentalEventInput {
  organizationId: string;
  actorUserId: string;
  rentalId: string;
  action: string;
  changes: Record<string, unknown>;
}

/**
 * Puerto de escritura de eventos de auditoria (TDD-KAIROS-TRANSVERSAL.md
 * 7.3: audit_events es una tabla transversal, reutilizada por los 6
 * modulos - esta es su unica implementacion de infraestructura).
 */
export abstract class AuditEventRepositoryPort {
  abstract recordLoginAttempt(input: RecordLoginAttemptInput): Promise<void>;

  /**
   * TR-05 (HU-23) - punto 11 del contrato: "Seleccion de contexto de trabajo".
   * `tx` opcional (hallazgo critico PR#4 "auditoria fuera de la
   * transaccion"): permite que este registro participe de la misma
   * transaccion que la validacion que lo precede.
   */
  abstract recordWorkContextSelection(
    input: RecordWorkContextSelectionInput,
    tx?: Prisma.TransactionClient,
  ): Promise<void>;

  /**
   * HU-27 (Reserva) - reutilizable por Alquiler/Devolucion, ver TDD-*-001
   * seccion 17/24 de cada modulo. `tx` opcional (hallazgo critico PR#6
   * "cambio de estado y auditoria no son atomicos"): permite que este
   * registro participe de la misma transaccion que la mutacion de la
   * reserva que lo precede - un fallo de auditoria revierte tambien la
   * mutacion.
   */
  abstract recordReservationEvent(
    input: RecordReservationEventInput,
    tx?: Prisma.TransactionClient,
  ): Promise<void>;

  /**
   * HU-26 (Consulta) - TDD-CON-001.md seccion 17: solo `close` y
   * `convert-to-*` auditan. `tx` opcional, mismo criterio que
   * `recordReservationEvent` (hallazgo critico de revision PR#7 "auditoria
   * no atomica": cierre/conversion se confirmaban antes de insertar el
   * evento de auditoria) - el llamador abre la transaccion y le pasa `tx`
   * para que un fallo de auditoria revierta tambien la mutacion.
   */
  abstract recordInquiryEvent(
    input: RecordInquiryEventInput,
    tx?: Prisma.TransactionClient,
  ): Promise<void>;

  /**
   * ADM-01/ADM-04 (PANTALLAS-V2-B-SOPORTE.md) - alta, baja o cambio de
   * asignacion de un usuario. `tx` opcional, mismo criterio que
   * recordReservationEvent: la escritura de auditoria participa de la
   * misma transaccion que la mutacion de la asignacion.
   */
  abstract recordAdminEvent(
    input: RecordAdminEventInput,
    tx?: Prisma.TransactionClient,
  ): Promise<void>;

  /**
   * ALQ-01..11 (Alquiler) - TDD-03-alquiler.md seccion 17.
   * `tx` opcional para atomicidad con la mutacion.
   */
  abstract recordRentalEvent(
    input: RecordRentalEventInput,
    tx?: Prisma.TransactionClient,
  ): Promise<void>;
}
