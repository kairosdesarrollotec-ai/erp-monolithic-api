import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { PrismaTransactionManager } from './prisma-transaction-manager';
import { TransactionManagerPort } from '../application/ports/transaction-manager.port';

@Global()
@Module({
  providers: [
    PrismaService,
    { provide: TransactionManagerPort, useClass: PrismaTransactionManager },
  ],
  exports: [PrismaService, TransactionManagerPort],
})
export class PrismaModule {}
