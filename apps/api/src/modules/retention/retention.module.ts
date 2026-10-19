import { Module } from '@nestjs/common';
import { ClockPort } from '../../common/application/ports/clock.port';
import { RetentionPurgePort } from './application/retention-purge.port';
import { RETENTION_CONFIG, RetentionPurgeService } from './application/retention-purge.service';
import { PrismaRetentionPurgeRepository } from './infrastructure/prisma-retention-purge.repository';
import { RetentionPurgeScheduler } from './infrastructure/retention-purge.scheduler';
import { loadRetentionConfig, RetentionConfig } from './retention.config';

/** Mantenimiento de retención (L-02). Sin controller: no expone HTTP. Ver RetentionPurgeService. */
@Module({
  providers: [
    { provide: RETENTION_CONFIG, useFactory: () => loadRetentionConfig() },
    { provide: RetentionPurgePort, useClass: PrismaRetentionPurgeRepository },
    {
      provide: RetentionPurgeService,
      inject: [RetentionPurgePort, ClockPort, RETENTION_CONFIG],
      useFactory: (purge: RetentionPurgePort, clock: ClockPort, config: RetentionConfig) =>
        new RetentionPurgeService(purge, clock, config),
    },
    RetentionPurgeScheduler,
  ],
})
export class RetentionModule {}
