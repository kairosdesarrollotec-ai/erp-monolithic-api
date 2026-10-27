import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import { ReservationReminderRecord } from '../../domain/reservation-reminder';
import {
  RegisterReminderInput,
  ReservationReminderRepositoryPort,
} from '../../application/ports/reservation-reminder-repository.port';

@Injectable()
export class PrismaReservationReminderRepository implements ReservationReminderRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findByReservationId(
    reservationId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<ReservationReminderRecord | null> {
    const client = tx ?? this.prisma;
    const row = await client.reservationReminder.findUnique({
      where: { reservationId },
    });
    return row ? this.toRecord(row) : null;
  }

  async registerReminder(
    input: RegisterReminderInput,
    tx?: Prisma.TransactionClient,
  ): Promise<ReservationReminderRecord> {
    const client = tx ?? this.prisma;
    const row = await client.reservationReminder.upsert({
      where: { reservationId: input.reservationId },
      create: {
        organizationId: input.organizationId,
        operatingCompanyId: input.operatingCompanyId,
        branchId: input.branchId,
        reservationId: input.reservationId,
        status: input.result,
        dueAt: input.dueAt,
        messageText: input.messageText,
        sentAt: input.sentAt,
        sentBy: input.sentBy,
        resultNote: input.note,
        attempts: 1,
        version: 1,
      },
      update: {
        status: input.result,
        sentAt: input.sentAt,
        sentBy: input.sentBy,
        resultNote: input.note,
        attempts: { increment: 1 },
        version: { increment: 1 },
      },
    });
    return this.toRecord(row);
  }

  private toRecord(row: {
    id: string;
    organizationId: string;
    operatingCompanyId: string;
    branchId: string;
    reservationId: string;
    status: 'PENDING' | 'SENT' | 'FAILED';
    dueAt: Date;
    messageText: string;
    generatedAt: Date;
    sentAt: Date | null;
    sentBy: string | null;
    resultNote: string | null;
    attempts: number;
    version: number;
    createdAt: Date;
    updatedAt: Date;
  }): ReservationReminderRecord {
    return {
      id: row.id,
      organizationId: row.organizationId,
      operatingCompanyId: row.operatingCompanyId,
      branchId: row.branchId,
      reservationId: row.reservationId,
      status: row.status,
      dueAt: row.dueAt,
      messageText: row.messageText,
      generatedAt: row.generatedAt,
      sentAt: row.sentAt,
      sentBy: row.sentBy,
      resultNote: row.resultNote,
      attempts: row.attempts,
      version: row.version,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
