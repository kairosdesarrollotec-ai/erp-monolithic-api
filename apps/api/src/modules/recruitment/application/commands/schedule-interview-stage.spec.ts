import { CandidateStage } from '@prisma/client';
import type { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import {
  BRANCH_ID,
  COMPANY_ID,
  buildMatrixAuth,
  buildTransactionManager,
  buildWorkContext,
} from '../../testing/recruitment-test-fixtures';
import { RecruitmentAccessService } from '../services/recruitment-access.service';
import type { CandidateRepositoryPort } from '../ports/candidate-repository.port';
import type { InterviewRepositoryPort } from '../ports/interview-repository.port';
import { ScheduleInterviewCommand } from './schedule-interview.command';
import { ScheduleInterviewHandler } from './schedule-interview.handler';
import { InterviewDateInPastError } from '../../domain/recruitment-errors';

/**
 * REC-P07/P08: cuando el candidato acepta (condiciones acordadas -> ver RecordNegotiation) y se agenda la entrevista,
 * pasa a la etapa ENTREVISTA. Agendar una entrevista tambien lo adelanta; nunca retrocede ni repite la etapa.
 */
function setup(stage: CandidateStage, processState: string = 'EN_NEGOCIACION') {
  const access = new RecruitmentAccessService(buildWorkContext('RRHH'), buildMatrixAuth());
  const tm = buildTransactionManager();
  const audit = { recordRecruitmentEvent: jest.fn() } as unknown as jest.Mocked<AuditEventRepositoryPort>;
  const candidates = {
    findScopedById: jest.fn().mockResolvedValue({ id: 'cand-1', stage, version: 3, decision: null, processState }),
    updateStage: jest.fn(),
  } as unknown as jest.Mocked<CandidateRepositoryPort>;
  const interviews = {
    create: jest.fn().mockResolvedValue({ id: 'int-1', candidateId: 'cand-1', scheduledAt: new Date(), isVirtual: true, interviewerId: 'i1' }),
  } as unknown as jest.Mocked<InterviewRepositoryPort>;
  const handler = new ScheduleInterviewHandler(access, candidates, interviews, tm, audit, { now: () => new Date('2026-10-05T00:00:00Z') } as never);
  const cmd = new ScheduleInterviewCommand('uid-1', 'cand-1', COMPANY_ID, BRANCH_ID, new Date('2026-10-20T10:00:00Z'), true, 'i1', 'https://meet');
  return { handler, cmd, candidates, tm };
}

describe('ScheduleInterviewHandler - etapa ENTREVISTA', () => {
  it.each([CandidateStage.NUEVO, CandidateStage.CONTACTADO])('%s avanza a ENTREVISTA con la version vigente', async (stage) => {
    const s = setup(stage);
    await s.handler.execute(s.cmd);
    expect(s.candidates.updateStage).toHaveBeenCalledWith('cand-1', CandidateStage.ENTREVISTA, 3, s.tm.tx);
  });

  it.each([CandidateStage.ENTREVISTA, CandidateStage.DECISION])('%s no cambia de etapa', async (stage) => {
    const s = setup(stage);
    await s.handler.execute(s.cmd);
    expect(s.candidates.updateStage).not.toHaveBeenCalled();
  });

  it('R-10: un candidato DESCARTADO no admite agendar entrevista (CANDIDATE_DISCARDED) y no crea ni avanza nada', async () => {
    const s = setup(CandidateStage.NUEVO, 'DESCARTADO');
    await expect(s.handler.execute(s.cmd)).rejects.toMatchObject({ code: 'CANDIDATE_DISCARDED' });
    expect(s.candidates.updateStage).not.toHaveBeenCalled();
  });

  it('no agenda una entrevista con fecha pasada (INTERVIEW_DATE_IN_PAST) y no crea ni avanza nada', async () => {
    const s = setup(CandidateStage.NUEVO);
    const past = new ScheduleInterviewCommand('uid-1', 'cand-1', COMPANY_ID, BRANCH_ID, new Date('2026-10-01T10:00:00Z'), true, 'i1', 'https://meet');
    await expect(s.handler.execute(past)).rejects.toBeInstanceOf(InterviewDateInPastError);
    expect(s.candidates.updateStage).not.toHaveBeenCalled();
  });
});
