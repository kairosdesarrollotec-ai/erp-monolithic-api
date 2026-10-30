import { InterviewResult } from '@prisma/client';
import type { AuditEventRepositoryPort } from '../../audit/application/ports/audit-event-repository.port';
import type { OutboxEventRepositoryPort } from '../../outbox/application/ports/outbox-event-repository.port';
import { DomainNotFoundError } from '../../../common/domain/domain-errors';
import {
  CandidateNotFoundError,
  InterviewNotFoundError,
} from '../domain/recruitment-errors';
import {
  BRANCH_ID,
  COMPANY_ID,
  FixedClock,
  RECRUITMENT_SCOPE,
  buildMatrixAuth,
  buildTransactionManager,
  buildWorkContext,
} from '../testing/recruitment-test-fixtures';
import { PrismaCandidateRepository } from '../infrastructure/persistence/prisma-candidate.repository';
import { PrismaInterviewRepository } from '../infrastructure/persistence/prisma-interview.repository';
import { PrismaVacancyRepository } from '../infrastructure/persistence/prisma-vacancy.repository';
import { RecruitmentAccessService } from './services/recruitment-access.service';
import type { CandidateRepositoryPort } from './ports/candidate-repository.port';
import type { InterviewRepositoryPort } from './ports/interview-repository.port';
import type { OnboardingRepositoryPort } from './ports/onboarding-repository.port';
import type { VacancyRepositoryPort } from './ports/vacancy-repository.port';
import { ChangeCandidateStageCommand } from './commands/change-candidate-stage.command';
import { ChangeCandidateStageHandler } from './commands/change-candidate-stage.handler';
import { CompleteOnboardingCommand } from './commands/complete-onboarding.command';
import { CompleteOnboardingHandler } from './commands/complete-onboarding.handler';
import { DecideCandidateCommand } from './commands/decide-candidate.command';
import { DecideCandidateHandler } from './commands/decide-candidate.handler';
import { EvaluateProbationCommand } from './commands/evaluate-probation.command';
import { EvaluateProbationHandler } from './commands/evaluate-probation.handler';
import { RecordInterviewResultCommand } from './commands/record-interview-result.command';
import { RecordInterviewResultHandler } from './commands/record-interview-result.handler';
import { ScheduleInterviewCommand } from './commands/schedule-interview.command';
import { ScheduleInterviewHandler } from './commands/schedule-interview.handler';
import { GetCandidateDetailHandler } from './queries/get-candidate-detail.handler';
import { GetCandidateDetailQuery } from './queries/get-candidate-detail.query';

/**
 * Seguridad multi-sede/empresa: un id de candidato/entrevista de otra sede o empresa se resuelve como
 * inexistente (404 de dominio, nunca 403) y jamas se consulta sin alcance.
 */
const UID = 'uid-1';
const OTHER_ID = 'cand-otra-sede';

function setup() {
  const access = new RecruitmentAccessService(buildWorkContext('RRHH'), buildMatrixAuth());
  const tm = buildTransactionManager();
  const audit = { recordRecruitmentEvent: jest.fn() } as unknown as jest.Mocked<AuditEventRepositoryPort>;
  const outbox = { publish: jest.fn() } as unknown as jest.Mocked<OutboxEventRepositoryPort>;
  const candidates = {
    findScopedById: jest.fn().mockResolvedValue(null),
    findDetailById: jest.fn().mockResolvedValue(null),
    updateStage: jest.fn(),
    updateDecision: jest.fn(),
  } as unknown as jest.Mocked<CandidateRepositoryPort>;
  const interviews = {
    findScopedById: jest.fn().mockResolvedValue(null),
    create: jest.fn(),
    recordResult: jest.fn(),
  } as unknown as jest.Mocked<InterviewRepositoryPort>;
  const onb = {
    complete: jest.fn(),
    findByCandidateId: jest.fn(),
    evaluateProbation: jest.fn(),
  } as unknown as jest.Mocked<OnboardingRepositoryPort>;
  const vacancies = { findById: jest.fn() } as unknown as jest.Mocked<VacancyRepositoryPort>;
  return { access, tm, audit, outbox, candidates, interviews, onb, vacancies, clock: new FixedClock() };
}

describe('Reclutamiento - ids de otra sede/empresa devuelven 404 (alcance)', () => {
  it('ChangeCandidateStage', async () => {
    const s = setup();
    const h = new ChangeCandidateStageHandler(s.access, s.candidates, s.tm, s.audit);
    const p = h.execute(new ChangeCandidateStageCommand(UID, OTHER_ID, COMPANY_ID, BRANCH_ID, 'CONTACTADO' as never, 1));
    await expect(p).rejects.toBeInstanceOf(CandidateNotFoundError);
    expect(s.candidates.findScopedById).toHaveBeenCalledWith(OTHER_ID, RECRUITMENT_SCOPE, s.tm.tx);
    expect(s.candidates.updateStage).not.toHaveBeenCalled();
  });

  it('DecideCandidate', async () => {
    const s = setup();
    const h = new DecideCandidateHandler(s.access, s.candidates, s.tm, s.clock, s.audit, s.outbox, s.vacancies);
    const p = h.execute(new DecideCandidateCommand(UID, OTHER_ID, COMPANY_ID, BRANCH_ID, 'RECHAZADO' as never, 1, 'x'));
    await expect(p).rejects.toBeInstanceOf(CandidateNotFoundError);
    expect(s.candidates.findScopedById).toHaveBeenCalledWith(OTHER_ID, RECRUITMENT_SCOPE, s.tm.tx);
    expect(s.candidates.updateDecision).not.toHaveBeenCalled();
    expect(s.outbox.publish).not.toHaveBeenCalled();
  });

  it('CompleteOnboarding', async () => {
    const s = setup();
    const h = new CompleteOnboardingHandler(s.access, s.candidates, s.vacancies, s.onb, s.tm, s.clock, s.audit, s.outbox);
    const p = h.execute(
      new CompleteOnboardingCommand(UID, OTHER_ID, COMPANY_ID, BRANCH_ID, new Date('2026-10-10T00:00:00Z'), true, true, true, false),
    );
    await expect(p).rejects.toBeInstanceOf(CandidateNotFoundError);
    expect(s.candidates.findScopedById).toHaveBeenCalledWith(OTHER_ID, RECRUITMENT_SCOPE, s.tm.tx);
    expect(s.onb.complete).not.toHaveBeenCalled();
  });

  it('EvaluateProbation', async () => {
    const s = setup();
    const h = new EvaluateProbationHandler(s.access, s.candidates, s.onb, s.tm, s.clock, s.audit, s.outbox);
    const p = h.execute(new EvaluateProbationCommand(UID, OTHER_ID, COMPANY_ID, BRANCH_ID, true, 'ok'));
    await expect(p).rejects.toBeInstanceOf(CandidateNotFoundError);
    expect(s.candidates.findScopedById).toHaveBeenCalledWith(OTHER_ID, RECRUITMENT_SCOPE, s.tm.tx);
    expect(s.onb.findByCandidateId).not.toHaveBeenCalled();
    expect(s.onb.evaluateProbation).not.toHaveBeenCalled();
  });

  it('ScheduleInterview', async () => {
    const s = setup();
    const h = new ScheduleInterviewHandler(s.access, s.candidates, s.interviews, s.tm, s.audit, { now: () => new Date('2026-10-05T00:00:00Z') } as never);
    const p = h.execute(
      new ScheduleInterviewCommand(UID, OTHER_ID, COMPANY_ID, BRANCH_ID, new Date('2026-10-20T10:00:00Z'), true, 'int-1', 'https://meet', null),
    );
    await expect(p).rejects.toBeInstanceOf(CandidateNotFoundError);
    expect(s.candidates.findScopedById).toHaveBeenCalledWith(OTHER_ID, RECRUITMENT_SCOPE, s.tm.tx);
    expect(s.interviews.create).not.toHaveBeenCalled();
  });

  it('RecordInterviewResult: entrevista fuera de alcance -> 404', async () => {
    const s = setup();
    const h = new RecordInterviewResultHandler(s.access, s.candidates, s.interviews, s.tm, s.clock, s.audit, s.vacancies);
    const p = h.execute(new RecordInterviewResultCommand(UID, 'int-x', COMPANY_ID, BRANCH_ID, InterviewResult.AVANZA, 'notas'));
    await expect(p).rejects.toBeInstanceOf(InterviewNotFoundError);
    expect(s.interviews.findScopedById).toHaveBeenCalledWith('int-x', RECRUITMENT_SCOPE, s.tm.tx);
    expect(s.candidates.findScopedById).not.toHaveBeenCalled();
    expect(s.interviews.recordResult).not.toHaveBeenCalled();
  });

  it('RecordInterviewResult: candidato de la entrevista fuera de alcance -> 404', async () => {
    const s = setup();
    s.interviews.findScopedById.mockResolvedValue({ id: 'int-x', candidateId: OTHER_ID } as never);
    const h = new RecordInterviewResultHandler(s.access, s.candidates, s.interviews, s.tm, s.clock, s.audit, s.vacancies);
    const p = h.execute(new RecordInterviewResultCommand(UID, 'int-x', COMPANY_ID, BRANCH_ID, InterviewResult.AVANZA, 'notas'));
    await expect(p).rejects.toBeInstanceOf(CandidateNotFoundError);
    expect(s.interviews.recordResult).not.toHaveBeenCalled();
  });

  it('GetCandidateDetail', async () => {
    const s = setup();
    const h = new GetCandidateDetailHandler(s.access, s.candidates);
    await expect(h.execute(new GetCandidateDetailQuery(UID, OTHER_ID, COMPANY_ID, BRANCH_ID))).rejects.toBeInstanceOf(
      CandidateNotFoundError,
    );
    expect(s.candidates.findDetailById).toHaveBeenCalledWith(OTHER_ID, RECRUITMENT_SCOPE);
  });

  it('los errores son DomainNotFoundError (404), no Forbidden', () => {
    expect(new CandidateNotFoundError('x')).toBeInstanceOf(DomainNotFoundError);
    expect(new InterviewNotFoundError('x')).toBeInstanceOf(DomainNotFoundError);
  });
});

describe('Repositorios de Reclutamiento filtran por organizacion + empresa + sede', () => {
  const sedeFilter = {
    organizationId: RECRUITMENT_SCOPE.organizationId,
    operatingCompanyId: RECRUITMENT_SCOPE.operatingCompanyId,
  };

  it('candidatos: findDetailById y findScopedById usan findFirst con alcance', async () => {
    const prisma = { candidate: { findFirst: jest.fn().mockResolvedValue(null), findUnique: jest.fn() } };
    const repo = new PrismaCandidateRepository(prisma as never);
    expect(await repo.findDetailById('c1', RECRUITMENT_SCOPE)).toBeNull();
    expect(await repo.findScopedById('c1', RECRUITMENT_SCOPE)).toBeNull();
    for (const call of prisma.candidate.findFirst.mock.calls) {
      expect(call[0].where).toEqual({ id: 'c1', ...sedeFilter, vacancy: { branchId: BRANCH_ID } });
    }
    expect(prisma.candidate.findFirst).toHaveBeenCalledTimes(2);
    expect(prisma.candidate.findUnique).not.toHaveBeenCalled();
    expect((repo as unknown as Record<string, unknown>).findById).toBeUndefined();
  });

  it('entrevistas: findScopedById filtra por el candidato dentro del alcance', async () => {
    const prisma = { candidateInterview: { findFirst: jest.fn().mockResolvedValue(null), findUnique: jest.fn() } };
    const repo = new PrismaInterviewRepository(prisma as never);
    expect(await repo.findScopedById('i1', RECRUITMENT_SCOPE)).toBeNull();
    expect(prisma.candidateInterview.findFirst.mock.calls[0][0].where).toEqual({
      id: 'i1',
      candidate: { ...sedeFilter, vacancy: { branchId: BRANCH_ID } },
    });
    expect(prisma.candidateInterview.findUnique).not.toHaveBeenCalled();
    expect((repo as unknown as Record<string, unknown>).findById).toBeUndefined();
  });

  it('vacantes: findById y findDetailById siempre incluyen la sede', async () => {
    const prisma = { vacancy: { findFirst: jest.fn().mockResolvedValue(null) } };
    const repo = new PrismaVacancyRepository(prisma as never);
    await repo.findById('v1', RECRUITMENT_SCOPE);
    await repo.findDetailById('v1', RECRUITMENT_SCOPE);
    for (const call of prisma.vacancy.findFirst.mock.calls) {
      expect(call[0].where).toMatchObject({ id: 'v1', ...sedeFilter, branchId: BRANCH_ID });
    }
  });
});
