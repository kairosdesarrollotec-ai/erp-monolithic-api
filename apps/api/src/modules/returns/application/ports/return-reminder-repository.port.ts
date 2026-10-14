import type { Prisma } from '@prisma/client';
import type { ReturnReminderStatus } from '../../domain/return-reminder';
import type { ReturnReminderRecord, ReturnScope } from './return-repository.port';

/** Devolución PROGRAMADA sin recordatorio cuya hora pactada cae dentro de la ventana de generación. */
export interface ReminderCandidate {
  returnId: string;
  organizationId: string;
  operatingCompanyId: string;
  branchId: string;
  scheduledAt: Date;
  customerName: string | null;
  vehiclePlate: string | null;
}

export interface CreatePendingReminderInput {
  organizationId: string;
  operatingCompanyId: string;
  branchId: string;
  returnId: string;
  dueAt: Date;
  messageText: string;
}

export interface RegisterReminderResultInput {
  returnId: string;
  scope: ReturnScope;
  expectedVersion: number;
  status: 'SENT' | 'FAILED';
  sentAt: Date;
  sentBy: string;
  resultNote: string | null;
}

export interface ListRemindersFilter extends ReturnScope {
  statuses: readonly ReturnReminderStatus[];
  limit: number;
}

/** Fila de la bandeja de recordatorios (DEV-01): recordatorio + datos mínimos para contactar al cliente. */
export interface ReminderInboxItem {
  reminder: ReturnReminderRecord;
  returnId: string;
  rentalId: string;
  returnStatus: string;
  scheduledAt: Date;
  vehiclePlate: string | null;
  customerName: string | null;
  customerPhone: string | null;
}

export abstract class ReturnReminderRepositoryPort {
  /** Búsqueda transversal a tenants (proceso del sistema): PROGRAMADA, sin recordatorio, hora pactada en [since, until]. */
  abstract findCandidates(scheduledSince: Date, scheduledUntil: Date, limit: number): Promise<ReminderCandidate[]>;
  /** Idempotente: la unicidad return_id descarta duplicados (varias réplicas / reintentos). Devuelve las filas realmente creadas. */
  abstract createPending(inputs: readonly CreatePendingReminderInput[]): Promise<number>;
  abstract findByReturnId(returnId: string, scope: ReturnScope, tx?: Prisma.TransactionClient): Promise<ReturnReminderRecord | null>;
  /** Concurrencia optimista por `version`; lanza ReturnReminderVersionConflictError / ReturnReminderNotFoundError. */
  abstract registerResult(input: RegisterReminderResultInput, tx?: Prisma.TransactionClient): Promise<ReturnReminderRecord>;
  abstract list(filter: ListRemindersFilter): Promise<ReminderInboxItem[]>;
}
