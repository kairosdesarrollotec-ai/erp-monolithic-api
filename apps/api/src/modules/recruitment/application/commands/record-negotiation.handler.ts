import { Injectable } from '@nestjs/common';
import { CandidateStage, NegotiationOutcome } from '@prisma/client';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { RecruitmentAccessService } from '../services/recruitment-access.service';
import { CandidateDetailRecord, CandidateRepositoryPort } from '../ports/candidate-repository.port';
import { CandidateNotFoundError, CandidateVersionConflictError } from '../../domain/recruitment-errors';
import {
  assertCandidateNotDecided, assertCandidateNotDiscarded,
  assertNegotiationValid,
  maskCandidateSensitiveFields,
} from '../../domain/recruitment-rules';
import { RecordNegotiationCommand } from './record-negotiation.command';

const trimOrNull = (value?: string): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

/**
 * REC-04 "Negociacion registrada" (REC-P06/P07): agrega una ronda al historial append-only de condiciones.
 * - Es dato sensible (DAT-REC-003): exige REGISTER_CANDIDATE y VIEW_CANDIDATE_SENSITIVE_DATA.
 * - ACORDADA ("Acordar y continuar") avanza al candidato a ENTREVISTA si aun no la alcanzo (decision humana, nunca automatica).
 * - NO_ACORDADA exige motivo; el descarte formal sigue siendo la decision RECHAZADO de Gerencia/RR.HH.
 * - If-Match sobre la version del candidato.
 */
@Injectable()
export class RecordNegotiationHandler {
  constructor(
    private readonly access: RecruitmentAccessService,
    private readonly candidates: CandidateRepositoryPort,
    private readonly transactionManager: TransactionManagerPort,
    private readonly auditRepository: AuditEventRepositoryPort,
  ) {}

  async execute(command: RecordNegotiationCommand): Promise<CandidateDetailRecord> {
    const { context, scope } = await this.access.authorize(
      { firebaseUid: command.firebaseUid, companyId: command.companyId, branchId: command.branchId },
      'REGISTER_CANDIDATE',
    );
    await this.access.assertActionAllowed(context, 'VIEW_CANDIDATE_SENSITIVE_DATA');

    assertNegotiationValid({
      outcome: command.outcome,
      offeredSalary: command.offeredSalary,
      candidateSalary: command.candidateSalary,
      agreedSalary: command.agreedSalary,
      reason: command.reason,
    });

    return this.transactionManager.run(async (tx) => {
      const existing = await this.candidates.findScopedById(command.candidateId, scope, tx);
      if (!existing) {
        throw new CandidateNotFoundError(command.candidateId);
      }
      assertCandidateNotDecided(existing.decision);
      assertCandidateNotDiscarded(existing.processState);
      if (existing.version !== command.expectedVersion) {
        throw new CandidateVersionConflictError();
      }

      const negotiation = await this.candidates.addNegotiation(
        {
          candidateId: existing.id,
          offeredSalary: command.offeredSalary,
          offeredSchedule: trimOrNull(command.offeredSchedule),
          offeredOtherConditions: trimOrNull(command.offeredOtherConditions),
          candidateSalary: command.candidateSalary ?? null,
          candidateSchedule: trimOrNull(command.candidateSchedule),
          candidateOtherConditions: trimOrNull(command.candidateOtherConditions),
          candidateStartDate: command.candidateStartDate ?? null,
          outcome: command.outcome,
          agreedSalary: command.agreedSalary ?? null,
          agreedConditions: trimOrNull(command.agreedConditions),
          reason: trimOrNull(command.reason),
          recordedBy: command.firebaseUid,
        },
        tx,
      );

      await this.auditRepository.recordRecruitmentEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.firebaseUid,
          entityType: 'candidate',
          entityId: existing.id,
          action: 'NEGOTIATION_RECORDED',
          changes: {
            negotiationId: negotiation.id,
            outcome: negotiation.outcome,
            offeredSalary: negotiation.offeredSalary,
            candidateSalary: negotiation.candidateSalary,
            agreedSalary: negotiation.agreedSalary,
            reason: negotiation.reason,
          },
        },
        tx,
      );

      if (command.outcome === NegotiationOutcome.ACORDADA && existing.stage !== CandidateStage.ENTREVISTA
        && existing.stage !== CandidateStage.DECISION) {
        const advanced = await this.candidates.updateStage(existing.id, CandidateStage.ENTREVISTA, existing.version, tx);
        await this.auditRepository.recordRecruitmentEvent(
          {
            organizationId: context.organizationId,
            actorUserId: command.firebaseUid,
            entityType: 'candidate',
            entityId: existing.id,
            action: 'CANDIDATE_STAGE_CHANGED',
            changes: { fromStage: existing.stage, toStage: advanced.stage, version: advanced.version, via: 'NEGOTIATION_AGREED' },
          },
          tx,
        );
      }

      const detail = await this.candidates.findDetailById(existing.id, scope, tx);
      if (!detail) {
        throw new CandidateNotFoundError(existing.id);
      }
      return maskCandidateSensitiveFields(detail, true);
    });
  }
}
