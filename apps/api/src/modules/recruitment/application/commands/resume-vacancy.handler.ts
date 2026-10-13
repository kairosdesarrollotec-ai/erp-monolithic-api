import { Injectable } from '@nestjs/common';
import { VacancyStatus } from '@prisma/client';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { RecruitmentAccessService } from '../services/recruitment-access.service';
import { VacancyDetailRecord, VacancyRepositoryPort } from '../ports/vacancy-repository.port';
import { VacancyNotFoundError } from '../../domain/recruitment-errors';
import { assertValidVacancyTransition, assertVacancyResumable } from '../../domain/recruitment-rules';
import { ResumeVacancyCommand } from './resume-vacancy.command';

/** REC-02 "Reanudar": PAUSADA -> PUBLICADA (If-Match, auditoria). Conserva perfil y canales ya publicados. */
@Injectable()
export class ResumeVacancyHandler {
  constructor(
    private readonly access: RecruitmentAccessService,
    private readonly vacancies: VacancyRepositoryPort,
    private readonly transactionManager: TransactionManagerPort,
    private readonly auditRepository: AuditEventRepositoryPort,
  ) {}

  async execute(command: ResumeVacancyCommand): Promise<VacancyDetailRecord> {
    const { context, scope } = await this.access.authorize(
      { firebaseUid: command.firebaseUid, companyId: command.companyId, branchId: command.branchId },
      'PUBLISH_VACANCY',
    );

    return this.transactionManager.run(async (tx) => {
      const existing = await this.vacancies.findById(command.id, scope, tx);
      if (!existing) {
        throw new VacancyNotFoundError(command.id);
      }
      assertVacancyResumable(existing.status);
      assertValidVacancyTransition(existing.status, VacancyStatus.PUBLICADA);

      const resumed = await this.vacancies.updateStatus(command.id, VacancyStatus.PUBLICADA, command.expectedVersion, tx);

      await this.auditRepository.recordRecruitmentEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.firebaseUid,
          entityType: 'vacancy',
          entityId: resumed.id,
          action: 'VACANCY_RESUMED',
          changes: {
            fromStatus: existing.status,
            toStatus: resumed.status,
            version: resumed.version,
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
