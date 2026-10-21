import { Injectable } from '@nestjs/common';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { ClockPort } from '../../../../common/application/ports/clock.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import { RecruitmentAccessService } from '../services/recruitment-access.service';
import { CandidateRepositoryPort } from '../ports/candidate-repository.port';
import { OnboardingRecord, OnboardingRepositoryPort } from '../ports/onboarding-repository.port';
import {
  CandidateNotFoundError,
  GerenciaDecisionRequiredError,
  OnboardingNotFoundError,
  ProbationAlreadyEvaluatedError,
} from '../../domain/recruitment-errors';
import { CandidateProcessState } from '../../domain/recruitment-domain-types';
import { applyOnboardingFeeVisibility, assertCandidateProcessTransition } from '../../domain/recruitment-rules';
import { transitionCandidateProcess } from '../services/recruitment-progress';
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

    // Respuestas 2026-10-20 #13: el termino tras una prueba negativa lo registra Gerencia General.
    if (!command.passed && !(await this.access.isActionAllowed(context, 'TERMINATE_PROBATION'))) {
      throw new GerenciaDecisionRequiredError('Registrar el término tras una evaluación negativa del periodo de prueba');
    }

    return this.transactionManager.run(async (tx) => {
      const candidate = await this.candidates.findScopedById(command.candidateId, scope, tx);
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

      // BDD-REC §11.6: Periodo de prueba -> Planilla (evaluación positiva) | Terminado (negativa).
      const targetState = command.passed ? CandidateProcessState.PLANILLA : CandidateProcessState.TERMINADO;
      assertCandidateProcessTransition(candidate.processState, targetState);

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

      await transitionCandidateProcess(
        { candidates: this.candidates, audit: this.auditRepository },
        {
          candidate,
          to: targetState,
          at: now,
          organizationId: context.organizationId,
          actorUserId: command.firebaseUid,
          trigger: 'PROBATION_EVALUATED',
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
