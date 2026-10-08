import { Injectable } from '@nestjs/common';
import { CandidateDecision } from '@prisma/client';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { ClockPort } from '../../../../common/application/ports/clock.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import { RecruitmentAccessService } from '../services/recruitment-access.service';
import { CandidateDetailRecord, CandidateRepositoryPort } from '../ports/candidate-repository.port';
import { CandidateNotFoundError } from '../../domain/recruitment-errors';
import { assertCandidateNotDecided, maskCandidateSensitiveFields } from '../../domain/recruitment-rules';
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
      const existing = await this.candidates.findById(command.id, tx);
      if (!existing) {
        throw new CandidateNotFoundError(command.id);
      }

      assertCandidateNotDecided(existing.decision);

      const now = this.clock.now();
      const decided = await this.candidates.updateDecision(
        command.id,
        command.decision,
        command.decisionNotes ? command.decisionNotes.trim() : null,
        command.firebaseUid,
        now,
        command.expectedVersion,
        tx,
      );

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

      const detail = await this.candidates.findDetailById(command.id, tx);
      if (!detail) {
        throw new CandidateNotFoundError(command.id);
      }

      const canViewSensitive = await this.access.isActionAllowed(context, 'VIEW_CANDIDATE_SENSITIVE_DATA');
      return maskCandidateSensitiveFields(detail, canViewSensitive);
    });
  }
}
