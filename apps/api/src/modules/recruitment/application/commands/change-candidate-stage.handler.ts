import { Injectable } from '@nestjs/common';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { RecruitmentAccessService } from '../services/recruitment-access.service';
import { CandidateRecord, CandidateRepositoryPort } from '../ports/candidate-repository.port';
import { CandidateNotFoundError } from '../../domain/recruitment-errors';
import { assertCandidateNotDecided, assertCandidateNotDiscarded, assertCandidateStageTransition } from '../../domain/recruitment-rules';
import { ChangeCandidateStageCommand } from './change-candidate-stage.command';

@Injectable()
export class ChangeCandidateStageHandler {
  constructor(
    private readonly access: RecruitmentAccessService,
    private readonly candidates: CandidateRepositoryPort,
    private readonly transactionManager: TransactionManagerPort,
    private readonly auditRepository: AuditEventRepositoryPort,
  ) {}

  async execute(command: ChangeCandidateStageCommand): Promise<CandidateRecord> {
    const { context, scope } = await this.access.authorize(
      {
        firebaseUid: command.firebaseUid,
        companyId: command.companyId,
        branchId: command.branchId,
      },
      'REGISTER_CANDIDATE',
    );

    return this.transactionManager.run(async (tx) => {
      const existing = await this.candidates.findScopedById(command.id, scope, tx);
      if (!existing) {
        throw new CandidateNotFoundError(command.id);
      }

      assertCandidateNotDecided(existing.decision);
      assertCandidateNotDiscarded(existing.processState);
      assertCandidateStageTransition(existing.stage, command.stage);

      const updated = await this.candidates.updateStage(
        command.id,
        command.stage,
        command.expectedVersion,
        tx,
      );

      await this.auditRepository.recordRecruitmentEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.firebaseUid,
          entityType: 'candidate',
          entityId: updated.id,
          action: 'CANDIDATE_STAGE_CHANGED',
          changes: {
            fromStage: existing.stage,
            toStage: updated.stage,
            version: updated.version,
          },
        },
        tx,
      );

      return updated;
    });
  }
}
