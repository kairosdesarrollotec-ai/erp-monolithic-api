import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { AuditModule } from '../audit/audit.module';
import { OutboxModule } from '../outbox/outbox.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { RecruitmentAccessService } from './application/services/recruitment-access.service';

/**
 * Módulo de Reclutamiento y Selección (REC-01 a REC-08).
 * Administra el ciclo de vida de vacantes, candidatos, entrevistas cualitativas,
 * contratación exclusiva de Gerencia/RRHH, incorporación y periodo de prueba.
 */
@Module({
  imports: [UsersModule, AuditModule, OutboxModule, AuthorizationModule],
  controllers: [],
  providers: [RecruitmentAccessService],
  exports: [RecruitmentAccessService],
})
export class RecruitmentModule {}
