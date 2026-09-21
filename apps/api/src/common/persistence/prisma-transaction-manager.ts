import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { TransactionManagerPort } from '../application/ports/transaction-manager.port';

/** Implementacion real de TransactionManagerPort, respaldada por prisma.$transaction. */
@Injectable()
export class PrismaTransactionManager implements TransactionManagerPort {
  constructor(private readonly prisma: PrismaService) {}

  run<T>(
    work: (tx: Prisma.TransactionClient) => Promise<T>,
    options?: { isolationLevel?: Prisma.TransactionIsolationLevel },
  ): Promise<T> {
    return this.prisma.$transaction((tx: Prisma.TransactionClient) => work(tx), options);
  }
}
