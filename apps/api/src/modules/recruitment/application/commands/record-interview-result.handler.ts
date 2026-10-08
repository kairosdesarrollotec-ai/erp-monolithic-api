import { Injectable } from '@nestjs/common';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { ClockPort } from '../../../../common/application/ports/clock.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { RecruitmentAccessService } from '../services/recruitment-access.service';
import { CandidateRepositoryPort } from '../ports/candidate-repository.port';
import { CandidateInterviewRecord, InterviewRepositoryPort } from '../ports/interview-repository.port';
import { CandidateNotFoundError, InterviewNotFoundError } from '../../domain/recruitment-errors';
import { assertCandidateNotDecided } from '../../domain/recruitment-rules';
import { RecordInterviewResultCommand } from './record-interview-result.command';

@Injectable()
export class RecordInterviewResultHandler {
  constructor(
    private readonly access: RecruitmentAccessService,
    private readonly candidates: CandidateRepositoryPort,
    private readonly interviews: InterviewRepositoryPort,
    private readonly transactionManager: TransactionManagerPort,
    private readonly clock: ClockPort,
    private readonly auditRepository: AuditEventRepositoryPort,
  ) {}

  async execute(command: RecordInterviewResultCommand): Promise<CandidateInterviewRecord> {
    const { context } = await this.access.authorize(
      {
        firebaseUid: command.firebaseUid,
        companyId: command.companyId,
        branchId: command.branchId,
      },
      'MANAGE_INTERVIEW',
    );

    return this.transactionManager.run(async (tx) => {
      const interview = await this.interviews.findById(command.id, tx);
      if (!interview) {
        throw new InterviewNotFoundError(command.id);
      }

      const candidate = await this.candidates.findById(interview.candidateId, tx);
      if (!candidate) {
        throw new CandidateNotFoundError(interview.candidateId);
      }

      assertCandidateNotDecided(candidate.decision);

      const evaluatedAt = this.clock.now();
      const updated = await this.interviews.recordResult(
        command.id,
        {
          result: command.result,
          qualitativeNotes: command.qualitativeNotes.trim(),
          evaluatedAt,
        },
        tx,
      );

      await this.auditRepository.recordRecruitmentEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.firebaseUid,
          entityType: 'interview',
          entityId: updated.id,
          action: 'INTERVIEW_RESULT_RECORDED',
          changes: {
            result: updated.result,
            qualitativeNotes: updated.qualitativeNotes,
            evaluatedAt: updated.evaluatedAt,
          },
        },
        tx,
      );

      return updated;
    });
  }
}
