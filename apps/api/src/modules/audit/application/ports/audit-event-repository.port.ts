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
  /**
   * Opcionales (roles dinamicos): eventos administrativos cuya entidad NO es una
   * asignacion de usuario (p. ej. ROLE_CREATED / ROLE_RENAMED / ROLE_DEACTIVATED
   * usan entityType 'role' y entityId = id del rol). Por defecto:
   * 'admin_user_assignment' y `targetFirebaseUid` (comportamiento historico).
   */
  entityType?: string;
  entityId?: string;
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

export interface RecordIncidentEventInput {
  organizationId: string;
  actorUserId: string;
  incidentId: string;
  action: string;
  changes: Record<string, unknown>;
}

export interface RecordRecruitmentEventInput {
  organizationId: string;
  actorUserId: string;
  entityType: 'vacancy' | 'candidate' | 'interview' | 'onboarding';
  entityId: string;
  action: string;
  changes: Record<string, unknown>;
}

export interface RecordHrAdministrationEventInput {
  organizationId: string;
  actorUserId: string;
  entityType: 'employee' | 'attendance' | 'leave' | 'vacation' | 'field_trip' | 'termination';
  entityId: string;
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

  /**
   * INC-01/INC-02 (Incidencias) - registro, accion agregada, resolucion, cierre y derivacion a via legal.
   * `tx` opcional para atomicidad con la mutacion (mismo criterio que recordRentalEvent).
   */
  abstract recordIncidentEvent(
    input: RecordIncidentEventInput,
    tx?: Prisma.TransactionClient,
  ): Promise<void>;

  /**
   * REC-01..08 (Reclutamiento y Seleccion) - registro de vacantes, cambios de etapa, entrevistas, decision, etc.
   * `tx` opcional para atomicidad con la mutacion.
   */
  abstract recordRecruitmentEvent(
    input: RecordRecruitmentEventInput,
    tx?: Prisma.TransactionClient,
  ): Promise<void>;

  /**
   * ADP-P01..17 (Administracion de Personal) - asistencia, permisos, vacaciones, salidas a campo y desvinculaciones.
   * `tx` opcional para atomicidad con la mutacion.
   */
  abstract recordHrAdministrationEvent(
    input: RecordHrAdministrationEventInput,
    tx?: Prisma.TransactionClient,
  ): Promise<void>;
}
