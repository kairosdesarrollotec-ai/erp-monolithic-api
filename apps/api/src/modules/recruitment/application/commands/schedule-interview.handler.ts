import { Injectable } from '@nestjs/common';
import { CandidateStage } from '@prisma/client';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { RecruitmentAccessService } from '../services/recruitment-access.service';
import { CandidateRepositoryPort } from '../ports/candidate-repository.port';
import { CandidateInterviewRecord, InterviewRepositoryPort } from '../ports/interview-repository.port';
import { CandidateNotFoundError } from '../../domain/recruitment-errors';
import { assertCandidateNotDecided } from '../../domain/recruitment-rules';
import { ScheduleInterviewCommand } from './schedule-interview.command';

@Injectable()
export class ScheduleInterviewHandler {
  constructor(
    private readonly access: RecruitmentAccessService,
    private readonly candidates: CandidateRepositoryPort,
    private readonly interviews: InterviewRepositoryPort,
    private readonly transactionManager: TransactionManagerPort,
    private readonly auditRepository: AuditEventRepositoryPort,
  ) {}

  async execute(command: ScheduleInterviewCommand): Promise<CandidateInterviewRecord> {
    const { context, scope } = await this.access.authorize(
      {
        firebaseUid: command.firebaseUid,
        companyId: command.companyId,
        branchId: command.branchId,
      },
      'MANAGE_INTERVIEW',
    );

    return this.transactionManager.run(async (tx) => {
      const candidate = await this.candidates.findScopedById(command.candidateId, scope, tx);
      if (!candidate) {
        throw new CandidateNotFoundError(command.candidateId);
      }

      assertCandidateNotDecided(candidate.decision);

      const interview = await this.interviews.create(
        {
          candidateId: command.candidateId,
          scheduledAt: command.scheduledAt,
          isVirtual: command.isVirtual,
          meetUrl: command.meetUrl ?? null,
          location: command.location ?? null,
          interviewerId: command.interviewerId,
        },
        tx,
      );

      // Si el candidato estaba en etapa anterior, avanzamos a ENTREVISTA
      if (candidate.stage === CandidateStage.NUEVO || candidate.stage === CandidateStage.CONTACTADO) {
        await this.candidates.updateStage(candidate.id, CandidateStage.ENTREVISTA, candidate.version, tx);
      }

      await this.auditRepository.recordRecruitmentEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.firebaseUid,
          entityType: 'interview',
          entityId: interview.id,
          action: 'INTERVIEW_SCHEDULED',
          changes: {
            candidateId: interview.candidateId,
            scheduledAt: interview.scheduledAt,
            isVirtual: interview.isVirtual,
            interviewerId: interview.interviewerId,
          },
        },
        tx,
      );

      return interview;
    });
  }
}
