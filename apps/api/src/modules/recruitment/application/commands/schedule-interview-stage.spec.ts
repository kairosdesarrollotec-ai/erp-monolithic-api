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

/**
 * REC-P07/P08: cuando el candidato acepta (condiciones acordadas -> ver RecordNegotiation) y se agenda la entrevista,
 * pasa a la etapa ENTREVISTA. Agendar una entrevista tambien lo adelanta; nunca retrocede ni repite la etapa.
 */
function setup(stage: CandidateStage) {
  const access = new RecruitmentAccessService(buildWorkContext('RRHH'), buildMatrixAuth());
  const tm = buildTransactionManager();
  const audit = { recordRecruitmentEvent: jest.fn() } as unknown as jest.Mocked<AuditEventRepositoryPort>;
  const candidates = {
    findScopedById: jest.fn().mockResolvedValue({ id: 'cand-1', stage, version: 3, decision: null }),
    updateStage: jest.fn(),
  } as unknown as jest.Mocked<CandidateRepositoryPort>;
  const interviews = {
    create: jest.fn().mockResolvedValue({ id: 'int-1', candidateId: 'cand-1', scheduledAt: new Date(), isVirtual: true, interviewerId: 'i1' }),
  } as unknown as jest.Mocked<InterviewRepositoryPort>;
  const handler = new ScheduleInterviewHandler(access, candidates, interviews, tm, audit);
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
});
