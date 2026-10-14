import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import {
  CreatePendingReminderInput,
  ListRemindersFilter,
  ReminderCandidate,
  ReminderInboxItem,
  RegisterReminderResultInput,
  ReturnReminderRepositoryPort,
} from '../../application/ports/return-reminder-repository.port';
import type { ReturnReminderRecord, ReturnScope } from '../../application/ports/return-repository.port';
import { ReturnReminderNotFoundError, ReturnReminderVersionConflictError } from '../../domain/return-errors';
import { toReturnReminderRecord } from './return-persistence.mapper';

function scopeWhere(returnId: string, scope: ReturnScope): Prisma.ReturnReminderWhereInput {
  return {
    returnId,
    organizationId: scope.organizationId,
    operatingCompanyId: scope.operatingCompanyId,
    branchId: scope.branchId,
  };
}

@Injectable()
export class PrismaReturnReminderPersistence implements ReturnReminderRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findCandidates(scheduledSince: Date, scheduledUntil: Date, limit: number): Promise<ReminderCandidate[]> {
    const rows = await this.prisma.rentalReturn.findMany({
      where: {
        status: 'PROGRAMADA',
        scheduledAt: { gte: scheduledSince, lte: scheduledUntil },
        reminder: { is: null },
      },
      select: {
        id: true,
        organizationId: true,
        operatingCompanyId: true,
        branchId: true,
        scheduledAt: true,
        customer: { select: { fullName: true } },
        vehicle: { select: { plate: true } },
      },
      orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }],
      take: limit,
    });
    return rows.map((row) => ({
      returnId: row.id,
      organizationId: row.organizationId,
      operatingCompanyId: row.operatingCompanyId,
      branchId: row.branchId,
      scheduledAt: row.scheduledAt,
      customerName: row.customer.fullName,
      vehiclePlate: row.vehicle.plate,
    }));
  }

  async createPending(inputs: readonly CreatePendingReminderInput[]): Promise<number> {
    if (inputs.length === 0) return 0;
    const result = await this.prisma.returnReminder.createMany({
      data: inputs.map((input) => ({
        organizationId: input.organizationId,
        operatingCompanyId: input.operatingCompanyId,
        branchId: input.branchId,
        returnId: input.returnId,
        dueAt: input.dueAt,
        messageText: input.messageText,
      })),
      skipDuplicates: true,
    });
    return result.count;
  }

  async findByReturnId(
    returnId: string,
    scope: ReturnScope,
    tx?: Prisma.TransactionClient,
  ): Promise<ReturnReminderRecord | null> {
    const client = tx ?? this.prisma;
    const row = await client.returnReminder.findFirst({ where: scopeWhere(returnId, scope) });
    return row ? toReturnReminderRecord(row) : null;
  }

  async registerResult(input: RegisterReminderResultInput, tx?: Prisma.TransactionClient): Promise<ReturnReminderRecord> {
    const client = tx ?? this.prisma;
    const result = await client.returnReminder.updateMany({
      where: { ...scopeWhere(input.returnId, input.scope), version: input.expectedVersion, status: { not: 'SENT' } },
      data: {
        status: input.status,
        sentAt: input.sentAt,
        sentBy: input.sentBy,
        resultNote: input.resultNote,
        attempts: { increment: 1 },
        version: { increment: 1 },
      },
    });
    if (result.count === 0) {
      const exists = await client.returnReminder.findFirst({
        where: scopeWhere(input.returnId, input.scope),
        select: { id: true },
      });
      throw exists ? new ReturnReminderVersionConflictError() : new ReturnReminderNotFoundError(input.returnId);
    }
    const updated = await client.returnReminder.findFirstOrThrow({ where: scopeWhere(input.returnId, input.scope) });
    return toReturnReminderRecord(updated);
  }

  async list(filter: ListRemindersFilter): Promise<ReminderInboxItem[]> {
    const rows = await this.prisma.returnReminder.findMany({
      where: {
        organizationId: filter.organizationId,
        operatingCompanyId: filter.operatingCompanyId,
        branchId: filter.branchId,
        status: { in: [...filter.statuses] },
      },
      orderBy: [{ dueAt: 'asc' }, { id: 'asc' }],
      take: filter.limit,
      include: {
        rentalReturn: {
          select: {
            id: true,
            rentalId: true,
            status: true,
            scheduledAt: true,
            customer: { select: { fullName: true, phone: true } },
            vehicle: { select: { plate: true } },
          },
        },
      },
    });
    return rows.map((row) => ({
      reminder: toReturnReminderRecord(row),
      returnId: row.rentalReturn.id,
      rentalId: row.rentalReturn.rentalId,
      returnStatus: row.rentalReturn.status,
      scheduledAt: row.rentalReturn.scheduledAt,
      vehiclePlate: row.rentalReturn.vehicle.plate,
      customerName: row.rentalReturn.customer.fullName,
      customerPhone: row.rentalReturn.customer.phone,
    }));
  }
}
