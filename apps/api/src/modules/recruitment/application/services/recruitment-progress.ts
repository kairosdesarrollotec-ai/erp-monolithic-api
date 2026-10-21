import type { Prisma } from '@prisma/client';
import type { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import type { CandidateProcessState, VacancyStatus } from '../../domain/recruitment-domain-types';
import { assertCandidateProcessTransition, resolveVacancyProgress } from '../../domain/recruitment-rules';
import type { CandidateRecord, CandidateRepositoryPort } from '../ports/candidate-repository.port';
import type { VacancyRecord, VacancyRepositoryPort } from '../ports/vacancy-repository.port';

/**
 * Avance de la Vacante por el flujo BDD-REC §11.6 (Publicado -> En negociación -> Entrevistado -> Decidido).
 * Monótono y tolerante: si la vacante ya está en ese estado o más adelante, o es PAUSADA/CANCELADA/NECESIDAD, no hace nada.
 * Se ejecuta dentro de la transacción del comando que lo provoca y deja rastro de auditoría.
 */
export async function advanceVacancyProgress(
  deps: { vacancies: VacancyRepositoryPort; audit: AuditEventRepositoryPort },
  input: {
    vacancy: Pick<VacancyRecord, 'id' | 'status' | 'version'>;
    target: VacancyStatus;
    organizationId: string;
    actorUserId: string;
    /** Comando que provoca el avance (para el rastro de auditoría). */
    trigger: string;
  },
  tx: Prisma.TransactionClient,
): Promise<VacancyRecord | null> {
  const next = resolveVacancyProgress(input.vacancy.status as VacancyStatus, input.target);
  if (!next) {
    return null;
  }
  const updated = await deps.vacancies.updateStatus(input.vacancy.id, next as never, input.vacancy.version, tx);
  await deps.audit.recordRecruitmentEvent(
    {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      entityType: 'vacancy',
      entityId: input.vacancy.id,
      action: 'VACANCY_PROGRESSED',
      changes: {
        fromStatus: input.vacancy.status,
        toStatus: updated.status,
        trigger: input.trigger,
        version: updated.version,
      },
    },
    tx,
  );
  return updated;
}

/**
 * Transición del estado de proceso del candidato (BDD-REC §11.6): valida contra la tabla de entradas/salidas
 * permitidas, escribe con compare-and-set y audita `CANDIDATE_PROCESS_STATE_CHANGED`.
 */
export async function transitionCandidateProcess(
  deps: { candidates: CandidateRepositoryPort; audit: AuditEventRepositoryPort },
  input: {
    candidate: Pick<CandidateRecord, 'id' | 'processState'>;
    to: CandidateProcessState;
    at: Date;
    organizationId: string;
    actorUserId: string;
    trigger: string;
  },
  tx: Prisma.TransactionClient,
): Promise<CandidateRecord> {
  assertCandidateProcessTransition(input.candidate.processState, input.to);
  const updated = await deps.candidates.updateProcessState(input.candidate.id, input.candidate.processState, input.to, input.at, tx);
  await deps.audit.recordRecruitmentEvent(
    {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      entityType: 'candidate',
      entityId: input.candidate.id,
      action: 'CANDIDATE_PROCESS_STATE_CHANGED',
      changes: { fromState: input.candidate.processState, toState: input.to, trigger: input.trigger },
    },
    tx,
  );
  return updated;
}
