import { Injectable } from '@nestjs/common';
import { CandidateDecision } from '@prisma/client';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { ClockPort } from '../../../../common/application/ports/clock.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import { RecruitmentAccessService } from '../services/recruitment-access.service';
import { CandidateRepositoryPort } from '../ports/candidate-repository.port';
import { VacancyRepositoryPort } from '../ports/vacancy-repository.port';
import { OnboardingRecord, OnboardingRepositoryPort } from '../ports/onboarding-repository.port';
import { CandidateNotContractedError, CandidateNotFoundError, VacancyNotFoundError } from '../../domain/recruitment-errors';
import { applyOnboardingFeeVisibility, assertOnboardingValid } from '../../domain/recruitment-rules';
import { CompleteOnboardingCommand } from './complete-onboarding.command';

@Injectable()
export class CompleteOnboardingHandler {
  constructor(
    private readonly access: RecruitmentAccessService,
    private readonly candidates: CandidateRepositoryPort,
    private readonly vacancies: VacancyRepositoryPort,
    private readonly onboarding: OnboardingRepositoryPort,
    private readonly transactionManager: TransactionManagerPort,
    private readonly clock: ClockPort,
    private readonly auditRepository: AuditEventRepositoryPort,
    private readonly outboxRepository: OutboxEventRepositoryPort,
  ) {}

  async execute(command: CompleteOnboardingCommand): Promise<OnboardingRecord> {
    const { context, scope } = await this.access.authorize(
      {
        firebaseUid: command.firebaseUid,
        companyId: command.companyId,
        branchId: command.branchId,
      },
      'MANAGE_ONBOARDING',
    );

    return this.transactionManager.run(async (tx) => {
      const candidate = await this.candidates.findById(command.candidateId, tx);
      if (!candidate) {
        throw new CandidateNotFoundError(command.candidateId);
      }

      if (candidate.decision !== CandidateDecision.CONTRATADO) {
        throw new CandidateNotContractedError();
      }

      const vacancy = await this.vacancies.findById(candidate.vacancyId, scope, tx);
      if (!vacancy) {
        throw new VacancyNotFoundError(candidate.vacancyId);
      }

      assertOnboardingValid(vacancy.isMechanic, {
        startDate: command.startDate,
        inductionScheduled: command.inductionScheduled,
        equipmentAssigned: command.equipmentAssigned,
        responsibilityCardSigned: command.responsibilityCardSigned,
        notarizedContractSigned: command.notarizedContractSigned,
      });

      const now = this.clock.now();
      const completed = await this.onboarding.complete(
        {
          candidateId: command.candidateId,
          startDate: command.startDate,
          inductionScheduled: command.inductionScheduled,
          equipmentAssigned: command.equipmentAssigned,
          responsibilityCardSigned: command.responsibilityCardSigned,
          notarizedContractSigned: command.notarizedContractSigned,
          completedAt: now,
          completedBy: command.firebaseUid,
        },
        tx,
      );

      await this.outboxRepository.publish(
        {
          aggregateType: 'EmployeeOnboarding',
          aggregateId: completed.id,
          eventType: 'PersonalIncorporado.v1',
          payload: {
            candidateId: completed.candidateId,
            vacancyId: candidate.vacancyId,
            startDate: completed.startDate.toISOString(),
            isMechanic: vacancy.isMechanic,
            completedAt: now.toISOString(),
            actorUserId: command.firebaseUid,
            organizationId: context.organizationId,
            operatingCompanyId: scope.operatingCompanyId,
            branchId: scope.branchId,
          },
        },
        tx,
      );

      await this.auditRepository.recordRecruitmentEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.firebaseUid,
          entityType: 'onboarding',
          entityId: completed.id,
          action: 'ONBOARDING_COMPLETED',
          changes: {
            candidateId: completed.candidateId,
            startDate: completed.startDate,
            isCompleted: completed.isCompleted,
            notarizedContractSigned: completed.notarizedContractSigned,
          },
        },
        tx,
      );

      return applyOnboardingFeeVisibility(completed, await this.access.isActionAllowed(context, 'VIEW_CANDIDATE_SENSITIVE_DATA'));
    });
  }
}
