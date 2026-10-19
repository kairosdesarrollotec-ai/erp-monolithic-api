import { Injectable } from '@nestjs/common';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { ClockPort } from '../../../../common/application/ports/clock.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { RecruitmentAccessService } from '../services/recruitment-access.service';
import { CandidateRepositoryPort } from '../ports/candidate-repository.port';
import { CandidateInterviewRecord, InterviewRepositoryPort } from '../ports/interview-repository.port';
import { VacancyRepositoryPort } from '../ports/vacancy-repository.port';
import { CandidateNotFoundError, InterviewNotFoundError } from '../../domain/recruitment-errors';
import { CandidateProcessState, VacancyStatus } from '../../domain/recruitment-domain-types';
import { advanceVacancyProgress, transitionCandidateProcess } from '../services/recruitment-progress';
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
    private readonly vacancies: VacancyRepositoryPort,
  ) {}

  async execute(command: RecordInterviewResultCommand): Promise<CandidateInterviewRecord> {
    const { context, scope } = await this.access.authorize(
      {
        firebaseUid: command.firebaseUid,
        companyId: command.companyId,
        branchId: command.branchId,
      },
      'MANAGE_INTERVIEW',
    );

    return this.transactionManager.run(async (tx) => {
      const interview = await this.interviews.findScopedById(command.id, scope, tx);
      if (!interview) {
        throw new InterviewNotFoundError(command.id);
      }

      const candidate = await this.candidates.findScopedById(interview.candidateId, scope, tx);
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

      // BDD-REC §11.6: "Entrevistado = entrevista realizada, en análisis". Registrar el resultado (Avanza o No avanza)
      // marca la entrevista como realizada; NO descarta ni decide (la decisión es exclusiva de Fiorella, BR-REC-003).
      // Con varias entrevistas, la segunda y siguientes no cambian el estado.
      if (candidate.processState === CandidateProcessState.EN_NEGOCIACION) {
        await transitionCandidateProcess(
          { candidates: this.candidates, audit: this.auditRepository },
          {
            candidate,
            to: CandidateProcessState.ENTREVISTADO,
            at: evaluatedAt,
            organizationId: context.organizationId,
            actorUserId: command.firebaseUid,
            trigger: 'INTERVIEW_RESULT_RECORDED',
          },
          tx,
        );
        const vacancy = await this.vacancies.findById(candidate.vacancyId, scope, tx);
        if (vacancy) {
          await advanceVacancyProgress(
            { vacancies: this.vacancies, audit: this.auditRepository },
            {
              vacancy,
              target: VacancyStatus.ENTREVISTADA,
              organizationId: context.organizationId,
              actorUserId: command.firebaseUid,
              trigger: 'INTERVIEW_RESULT_RECORDED',
            },
            tx,
          );
        }
      }

      return updated;
    });
  }
}
