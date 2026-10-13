import { Injectable } from '@nestjs/common';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { ClockPort } from '../../../../common/application/ports/clock.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import { RecruitmentAccessService } from '../services/recruitment-access.service';
import { CandidateRepositoryPort } from '../ports/candidate-repository.port';
import { OnboardingRecord, OnboardingRepositoryPort } from '../ports/onboarding-repository.port';
import { CandidateNotFoundError, OnboardingNotFoundError, ProbationAlreadyEvaluatedError } from '../../domain/recruitment-errors';
import { applyOnboardingFeeVisibility } from '../../domain/recruitment-rules';
import { EvaluateProbationCommand } from './evaluate-probation.command';

@Injectable()
export class EvaluateProbationHandler {
  constructor(
    private readonly access: RecruitmentAccessService,
    private readonly candidates: CandidateRepositoryPort,
    private readonly onboarding: OnboardingRepositoryPort,
    private readonly transactionManager: TransactionManagerPort,
    private readonly clock: ClockPort,
    private readonly auditRepository: AuditEventRepositoryPort,
    private readonly outboxRepository: OutboxEventRepositoryPort,
  ) {}

  async execute(command: EvaluateProbationCommand): Promise<OnboardingRecord> {
    const { context, scope } = await this.access.authorize(
      {
        firebaseUid: command.firebaseUid,
        companyId: command.companyId,
        branchId: command.branchId,
      },
      'EVALUATE_PROBATION',
    );

    return this.transactionManager.run(async (tx) => {
      const candidate = await this.candidates.findById(command.candidateId, tx);
      if (!candidate) {
        throw new CandidateNotFoundError(command.candidateId);
      }

      const existingOnboarding = await this.onboarding.findByCandidateId(command.candidateId, tx);
      if (!existingOnboarding) {
        throw new OnboardingNotFoundError();
      }

      if (existingOnboarding.probationPassed !== null) {
        throw new ProbationAlreadyEvaluatedError();
      }

      const now = this.clock.now();
      const updated = await this.onboarding.evaluateProbation(
        command.candidateId,
        {
          passed: command.passed,
          qualitativeEvaluation: command.qualitativeEvaluation.trim(),
          evaluatedAt: now,
          evaluatedBy: command.firebaseUid,
        },
        tx,
      );

      if (command.passed) {
        await this.outboxRepository.publish(
          {
            aggregateType: 'EmployeeOnboarding',
            aggregateId: updated.id,
            eventType: 'PasoAPlanilla.v1',
            payload: {
              candidateId: updated.candidateId,
              vacancyId: candidate.vacancyId,
              fullName: candidate.fullName,
              documentNumber: candidate.documentNumber,
              passed: true,
              qualitativeEvaluation: updated.probationEvaluation,
              evaluatedAt: now.toISOString(),
              actorUserId: command.firebaseUid,
              organizationId: context.organizationId,
              operatingCompanyId: scope.operatingCompanyId,
              branchId: scope.branchId,
            },
          },
          tx,
        );
      }

      await this.auditRepository.recordRecruitmentEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.firebaseUid,
          entityType: 'onboarding',
          entityId: updated.id,
          action: 'PROBATION_EVALUATED',
          changes: {
            candidateId: updated.candidateId,
            passed: updated.probationPassed,
            qualitativeEvaluation: updated.probationEvaluation,
            evaluatedAt: updated.probationEvaluatedAt,
          },
        },
        tx,
      );

      return applyOnboardingFeeVisibility(updated, await this.access.isActionAllowed(context, 'VIEW_CANDIDATE_SENSITIVE_DATA'));
    });
  }
}
