import { Injectable } from '@nestjs/common';
import { VacancyStatus } from '@prisma/client';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { RecruitmentAccessService } from '../services/recruitment-access.service';
import { VacancyDetailRecord, VacancyRepositoryPort } from '../ports/vacancy-repository.port';
import { VacancyNotFoundError } from '../../domain/recruitment-errors';
import { assertValidVacancyTransition, assertVacancyPausable } from '../../domain/recruitment-rules';
import { PauseVacancyCommand } from './pause-vacancy.command';

/** REC-02 "Pausar": PUBLICADA -> PAUSADA (If-Match, auditoria). Misma autorizacion que publicar. */
@Injectable()
export class PauseVacancyHandler {
  constructor(
    private readonly access: RecruitmentAccessService,
    private readonly vacancies: VacancyRepositoryPort,
    private readonly transactionManager: TransactionManagerPort,
    private readonly auditRepository: AuditEventRepositoryPort,
  ) {}

  async execute(command: PauseVacancyCommand): Promise<VacancyDetailRecord> {
    const { context, scope } = await this.access.authorize(
      { firebaseUid: command.firebaseUid, companyId: command.companyId, branchId: command.branchId },
      'PUBLISH_VACANCY',
    );

    return this.transactionManager.run(async (tx) => {
      const existing = await this.vacancies.findById(command.id, scope, tx);
      if (!existing) {
        throw new VacancyNotFoundError(command.id);
      }
      assertVacancyPausable(existing.status);
      assertValidVacancyTransition(existing.status, VacancyStatus.PAUSADA);

      const paused = await this.vacancies.updateStatus(command.id, VacancyStatus.PAUSADA, command.expectedVersion, tx);

      await this.auditRepository.recordRecruitmentEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.firebaseUid,
          entityType: 'vacancy',
          entityId: paused.id,
          action: 'VACANCY_PAUSED',
          changes: {
            fromStatus: existing.status,
            toStatus: paused.status,
            reason: command.reason?.trim() || null,
            version: paused.version,
          },
        },
        tx,
      );

      const detail = await this.vacancies.findDetailById(command.id, scope, tx);
      if (!detail) {
        throw new VacancyNotFoundError(command.id);
      }
      return detail;
    });
  }
}
