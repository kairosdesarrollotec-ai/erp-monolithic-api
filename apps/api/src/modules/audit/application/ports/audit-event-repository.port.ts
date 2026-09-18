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
}
