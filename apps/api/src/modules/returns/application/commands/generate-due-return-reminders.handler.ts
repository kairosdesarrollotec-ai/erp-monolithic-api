import { Injectable } from '@nestjs/common';
import { ClockPort } from '../../../../common/application/ports/clock.port';
import { ReturnReminderRepositoryPort } from '../ports/return-reminder-repository.port';
import { buildReminderText, reminderCandidateWindow, reminderDueAt } from '../../domain/return-reminder';

export interface GenerateDueRemindersResult {
  candidates: number;
  created: number;
}

/** Tope por ciclo (el scheduler corre cada pocos minutos; el resto se atiende en el ciclo siguiente). */
export const REMINDER_GENERATION_BATCH_SIZE = 200;

/**
 * DEV-01 / BR-DEV-004 (DEC-DEV-REMINDER-001) - Proceso del sistema (sin usuario): detecta devoluciones PROGRAMADA cuya
 * hora pactada cae dentro de las próximas 3 h y que aún no tienen recordatorio, y deja el recordatorio PENDING con el
 * texto ya generado. NO envía nada: el envío por WhatsApp es manual-asistido (la integración no existe). Idempotente
 * y seguro con varias réplicas (return_id UNIQUE + skipDuplicates).
 */
@Injectable()
export class GenerateDueReturnRemindersHandler {
  constructor(
    private readonly reminders: ReturnReminderRepositoryPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(): Promise<GenerateDueRemindersResult> {
    const window = reminderCandidateWindow(this.clock.now());
    const candidates = await this.reminders.findCandidates(
      window.scheduledSince,
      window.scheduledUntil,
      REMINDER_GENERATION_BATCH_SIZE,
    );
    if (candidates.length === 0) return { candidates: 0, created: 0 };

    const created = await this.reminders.createPending(
      candidates.map((c) => ({
        organizationId: c.organizationId,
        operatingCompanyId: c.operatingCompanyId,
        branchId: c.branchId,
        returnId: c.returnId,
        dueAt: reminderDueAt(c.scheduledAt),
        messageText: buildReminderText({
          customerName: c.customerName,
          vehiclePlate: c.vehiclePlate,
          scheduledAt: c.scheduledAt,
        }),
      })),
    );
    return { candidates: candidates.length, created };
  }
}
