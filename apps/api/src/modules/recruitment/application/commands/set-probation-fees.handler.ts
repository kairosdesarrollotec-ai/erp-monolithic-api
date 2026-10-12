import { Injectable } from '@nestjs/common';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { ClockPort } from '../../../../common/application/ports/clock.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { RecruitmentAccessService } from '../services/recruitment-access.service';
import { CandidateRepositoryPort } from '../ports/candidate-repository.port';
import { OnboardingRecord, OnboardingRepositoryPort } from '../ports/onboarding-repository.port';
import {
  CandidateNotFoundError,
  NegotiationInvalidError,
  OnboardingNotFoundError,
  ProbationAlreadyEvaluatedError,
} from '../../domain/recruitment-errors';
import { applyOnboardingFeeVisibility } from '../../domain/recruitment-rules';
import { SetProbationFeesCommand } from './set-probation-fees.command';

/**
 * REC-08 / BR-REC-005 / DAT-REC-007: captura de los honorarios del periodo de prueba (recibo por honorarios).
 * Solo captura y visualizacion: la documentacion no define una regla de calculo, asi que el sistema no calcula nada.
 * - Dato financiero: exige EVALUATE_PROBATION y VIEW_CANDIDATE_SENSITIVE_DATA.
 * - Solo mientras el periodo de prueba no haya sido evaluado. If-Match sobre la version de la incorporacion.
 */
@Injectable()
export class SetProbationFeesHandler {
  constructor(
    private readonly access: RecruitmentAccessService,
    private readonly candidates: CandidateRepositoryPort,
    private readonly onboarding: OnboardingRepositoryPort,
    private readonly transactionManager: TransactionManagerPort,
    private readonly clock: ClockPort,
    private readonly auditRepository: AuditEventRepositoryPort,
  ) {}

  async execute(command: SetProbationFeesCommand): Promise<OnboardingRecord> {
    const { context, scope } = await this.access.authorize(
      { firebaseUid: command.firebaseUid, companyId: command.companyId, branchId: command.branchId },
      'EVALUATE_PROBATION',
    );
    await this.access.assertActionAllowed(context, 'VIEW_CANDIDATE_SENSITIVE_DATA');

    for (const [label, value] of [
      ['Los honorarios mensuales', command.probationMonthlyFee],
      ['El sueldo posterior al periodo de prueba', command.postProbationMonthlySalary],
    ] as const) {
      if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
        throw new NegotiationInvalidError(`${label} deben ser un monto válido (mayor o igual a 0).`);
      }
    }

    return this.transactionManager.run(async (tx) => {
      const candidate = await this.candidates.findScopedById(command.candidateId, scope, tx);
      if (!candidate) {
        throw new CandidateNotFoundError(command.candidateId);
      }
      const existing = await this.onboarding.findByCandidateId(candidate.id, tx);
      if (!existing) {
        throw new OnboardingNotFoundError();
      }
      if (existing.probationPassed !== null) {
        throw new ProbationAlreadyEvaluatedError();
      }

      const updated = await this.onboarding.setProbationFees(
        candidate.id,
        {
          probationMonthlyFee: command.probationMonthlyFee,
          postProbationMonthlySalary: command.postProbationMonthlySalary ?? null,
          probationFeeNotes: command.probationFeeNotes?.trim() || null,
          recordedAt: this.clock.now(),
          recordedBy: command.firebaseUid,
        },
        command.expectedVersion,
        tx,
      );

      await this.auditRepository.recordRecruitmentEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.firebaseUid,
          entityType: 'onboarding',
          entityId: updated.id,
          action: 'PROBATION_FEES_RECORDED',
          changes: {
            candidateId: candidate.id,
            previous: {
              probationMonthlyFee: existing.probationMonthlyFee,
              postProbationMonthlySalary: existing.postProbationMonthlySalary,
            },
            probationMonthlyFee: updated.probationMonthlyFee,
            postProbationMonthlySalary: updated.postProbationMonthlySalary,
            version: updated.version,
          },
        },
        tx,
      );

      return applyOnboardingFeeVisibility(updated, true);
    });
  }
}
