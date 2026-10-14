import { Injectable } from '@nestjs/common';
import { ReminderInboxItem, ReturnReminderRepositoryPort } from '../ports/return-reminder-repository.port';
import { ReturnAccessService } from '../services/return-access.service';
import { ListReturnRemindersQuery } from './list-return-reminders.query';

/** DEV-01 - Bandeja de recordatorios pendientes de envío / fallidos (orden: el más urgente primero). */
@Injectable()
export class ListReturnRemindersHandler {
  constructor(
    private readonly access: ReturnAccessService,
    private readonly reminders: ReturnReminderRepositoryPort,
  ) {}

  async execute(query: ListReturnRemindersQuery): Promise<ReminderInboxItem[]> {
    const { scope } = await this.access.authorize(query, 'READ');
    return this.reminders.list({
      ...scope,
      statuses: query.statuses.length > 0 ? query.statuses : ['PENDING', 'FAILED'],
      limit: query.limit,
    });
  }
}
