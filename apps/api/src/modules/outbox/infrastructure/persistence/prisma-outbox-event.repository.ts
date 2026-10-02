import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import { OutboxEventRepositoryPort, PublishOutboxEventInput } from '../../application/ports/outbox-event-repository.port';

@Injectable()
export class PrismaOutboxEventRepository implements OutboxEventRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async publish(input: PublishOutboxEventInput, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx ?? this.prisma;
    await client.outboxEvent.create({
      data: {
        aggregateType: input.aggregateType,
        aggregateId: input.aggregateId,
        eventType: input.eventType,
        payload: input.payload as unknown as Prisma.InputJsonValue, // JsonValue compat
      },
    });
  }
}
