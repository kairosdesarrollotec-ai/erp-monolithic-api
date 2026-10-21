import { Injectable } from '@nestjs/common';
import { CandidateDecision } from '@prisma/client';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { ClockPort } from '../../../../common/application/ports/clock.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import { RecruitmentAccessService } from '../services/recruitment-access.service';
import { CandidateDetailRecord, CandidateRepositoryPort } from '../ports/candidate-repository.port';
import { VacancyRepositoryPort } from '../ports/vacancy-repository.port';
import { CandidateNotFoundError } from '../../domain/recruitment-errors';
import { VacancyStatus } from '../../domain/recruitment-domain-types';
import {
  assertCandidateNotDecided,
  maskCandidateSensitiveFields,
  resolveDecisionProcessState,
} from '../../domain/recruitment-rules';
import { advanceVacancyProgress } from '../services/recruitment-progress';
import { DecideCandidateCommand } from './decide-candidate.command';

@Injectable()
export class DecideCandidateHandler {
  constructor(
    private readonly access: RecruitmentAccessService,
    private readonly candidates: CandidateRepositoryPort,
    private readonly transactionManager: TransactionManagerPort,
    private readonly clock: ClockPort,
    private readonly auditRepository: AuditEventRepositoryPort,
    private readonly outboxRepository: OutboxEventRepositoryPort,
    private readonly vacancies: VacancyRepositoryPort,
  ) {}

  async execute(command: DecideCandidateCommand): Promise<CandidateDetailRecord> {
    const { context, scope } = await this.access.authorize(
      {
        firebaseUid: command.firebaseUid,
        companyId: command.companyId,
        branchId: command.branchId,
      },
      'DECIDE_CANDIDATE',
    );

    return this.transactionManager.run(async (tx) => {
      const existing = await this.candidates.findScopedById(command.id, scope, tx);
      if (!existing) {
        throw new CandidateNotFoundError(command.id);
      }

      assertCandidateNotDecided(existing.decision);

      // BDD-REC §11.6: Decidido solo se alcanza desde Entrevistado; Descartado desde En negociación o Decidido.
      // CONTRATADO exige haber registrado la entrevista; RECHAZADO puede descartar antes o después de entrevistar.
      const targetProcessState = resolveDecisionProcessState(existing.processState, command.decision);

      const now = this.clock.now();
      const decided = await this.candidates.updateDecision(
        command.id,
        command.decision,
        command.decisionNotes ? command.decisionNotes.trim() : null,
        command.firebaseUid,
        now,
        targetProcessState,
        command.expectedVersion,
        tx,
      );

      await this.auditRepository.recordRecruitmentEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.firebaseUid,
          entityType: 'candidate',
          entityId: decided.id,
          action: 'CANDIDATE_PROCESS_STATE_CHANGED',
          changes: {
            fromState: existing.processState,
            toState: decided.processState,
            // Tras la entrevista, un rechazo recorre Decidido -> Descartado (BDD-REC §11.6).
            ...(existing.processState === 'ENTREVISTADO' && decided.processState === 'DESCARTADO'
              ? { via: ['DECIDIDO', 'DESCARTADO'] }
              : {}),
            trigger: 'CANDIDATE_DECIDED',
          },
        },
        tx,
      );

      if (command.decision === CandidateDecision.CONTRATADO) {
        // TDD-REC §10.1: contratar transiciona la vacante a DECIDIDA (se hace en la misma transacción).
        const vacancy = await this.vacancies.findById(decided.vacancyId, scope, tx);
        if (vacancy) {
          await advanceVacancyProgress(
            { vacancies: this.vacancies, audit: this.auditRepository },
            {
              vacancy,
              target: VacancyStatus.DECIDIDA,
              organizationId: context.organizationId,
              actorUserId: command.firebaseUid,
              trigger: 'CANDIDATE_DECIDED',
            },
            tx,
          );
        }
      }

      if (command.decision === CandidateDecision.CONTRATADO) {
        await this.outboxRepository.publish(
          {
            aggregateType: 'Candidate',
            aggregateId: decided.id,
            eventType: 'CandidatoSeleccionado.v1',
            payload: {
              candidateId: decided.id,
              vacancyId: decided.vacancyId,
              fullName: decided.fullName,
              documentNumber: decided.documentNumber,
              decision: decided.decision,
              decidedAt: now.toISOString(),
              decidedBy: command.firebaseUid,
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
          entityType: 'candidate',
          entityId: decided.id,
          action: 'CANDIDATE_DECIDED',
          changes: {
            decision: decided.decision,
            decisionNotes: decided.decisionNotes,
            decidedAt: decided.decidedAt,
            version: decided.version,
          },
        },
        tx,
      );

      const detail = await this.candidates.findDetailById(command.id, scope, tx);
      if (!detail) {
        throw new CandidateNotFoundError(command.id);
      }

      const canViewSensitive = await this.access.isActionAllowed(context, 'VIEW_CANDIDATE_SENSITIVE_DATA');
      return maskCandidateSensitiveFields(detail, canViewSensitive);
    });
  }
}
