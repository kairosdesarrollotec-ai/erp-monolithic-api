import { Injectable } from '@nestjs/common';
import { VacancyStatus } from '@prisma/client';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { RecruitmentAccessService } from '../services/recruitment-access.service';
import { VacancyDetailRecord, VacancyRepositoryPort } from '../ports/vacancy-repository.port';
import { VacancyNotFoundError } from '../../domain/recruitment-errors';
import { assertMechanicChannels, assertValidVacancyTransition } from '../../domain/recruitment-rules';
import { PublishVacancyCommand } from './publish-vacancy.command';

@Injectable()
export class PublishVacancyHandler {
  constructor(
    private readonly access: RecruitmentAccessService,
    private readonly vacancies: VacancyRepositoryPort,
    private readonly transactionManager: TransactionManagerPort,
    private readonly auditRepository: AuditEventRepositoryPort,
  ) {}

  async execute(command: PublishVacancyCommand): Promise<VacancyDetailRecord> {
    const { context, scope } = await this.access.authorize(
      {
        firebaseUid: command.firebaseUid,
        companyId: command.companyId,
        branchId: command.branchId,
      },
      'PUBLISH_VACANCY',
    );

    return this.transactionManager.run(async (tx) => {
      const existing = await this.vacancies.findById(command.id, scope, tx);
      if (!existing) {
        throw new VacancyNotFoundError(command.id);
      }

      assertValidVacancyTransition(existing.status, VacancyStatus.PUBLICADA);
      assertMechanicChannels(existing.isMechanic, command.channels);

      const published = await this.vacancies.publish(
        command.id,
        {
          profileDescription: command.profileDescription.trim(),
          baseSalary: command.baseSalary,
          scheduleDetails: command.scheduleDetails.trim(),
          publishedChannels: command.channels,
        },
        command.expectedVersion,
        tx,
      );

      await this.auditRepository.recordRecruitmentEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.firebaseUid,
          entityType: 'vacancy',
          entityId: published.id,
          action: 'VACANCY_PUBLISHED',
          changes: {
            status: published.status,
            channels: published.publishedChannels,
            baseSalary: published.baseSalary,
            version: published.version,
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
