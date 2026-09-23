import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { PrismaTransactionManager } from './prisma-transaction-manager';
import { TransactionManagerPort } from '../application/ports/transaction-manager.port';
import { ClockPort, SystemClock } from '../application/ports/clock.port';

@Global()
@Module({
  providers: [
    PrismaService,
    { provide: TransactionManagerPort, useClass: PrismaTransactionManager },
    { provide: ClockPort, useClass: SystemClock },
  ],
  exports: [PrismaService, TransactionManagerPort, ClockPort],
})
export class PrismaModule {}
