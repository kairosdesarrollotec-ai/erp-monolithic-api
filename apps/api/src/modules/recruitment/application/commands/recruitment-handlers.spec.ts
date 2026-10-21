import { ForbiddenException } from '@nestjs/common';
import { CandidateDecision, CandidateStage } from '@prisma/client';
import { CandidateProcessState } from '../../domain/recruitment-domain-types';
import type { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import type { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import {
  CandidateAlreadyDecidedError,
  CandidateNotContractedError,
  CandidateStageRegressionError,
  OnboardingChecklistIncompleteError,
  OnboardingMissingNotarizedContractError,
  OnboardingNotFoundError,
  ProbationAlreadyEvaluatedError,
} from '../../domain/recruitment-errors';
import {
  BRANCH_ID,
  COMPANY_ID,
  FixedClock,
  buildMatrixAuth,
  buildTransactionManager,
  buildWorkContext,
} from '../../testing/recruitment-test-fixtures';
import { RecruitmentAccessService } from '../services/recruitment-access.service';
import type { CandidateRecord, CandidateRepositoryPort } from '../ports/candidate-repository.port';
import type { OnboardingRecord, OnboardingRepositoryPort } from '../ports/onboarding-repository.port';
import type { VacancyRepositoryPort } from '../ports/vacancy-repository.port';
import { ChangeCandidateStageCommand } from './change-candidate-stage.command';
import { ChangeCandidateStageHandler } from './change-candidate-stage.handler';
import { CompleteOnboardingCommand } from './complete-onboarding.command';
import { CompleteOnboardingHandler } from './complete-onboarding.handler';
import { DecideCandidateCommand } from './decide-candidate.command';
import { DecideCandidateHandler } from './decide-candidate.handler';
import { EvaluateProbationCommand } from './evaluate-probation.command';
import { EvaluateProbationHandler } from './evaluate-probation.handler';

const UID = 'uid-1';
const CAND_ID = 'cand-1';

function candidate(over: Partial<CandidateRecord> = {}): CandidateRecord {
  return {
    id: CAND_ID,
    vacancyId: 'vac-1',
    fullName: 'Ana Perez',
    documentType: 'DNI',
    documentNumber: '12345678',
    email: null,
    phone: null,
    cvDocumentId: null,
    cv: null,
    hasCv: false,
    salaryExpectation: null,
    stage: CandidateStage.ENTREVISTA,
    processState: CandidateProcessState.ENTREVISTADO,
    processStateChangedAt: null,
    decision: null,
    decisionNotes: null,
    decidedBy: null,
    decidedAt: null,
    version: 1,
    createdAt: new Date('2026-10-01T00:00:00Z'),
    updatedAt: new Date('2026-10-01T00:00:00Z'),
    ...over,
  };
}

function onboarding(over: Partial<OnboardingRecord> = {}): OnboardingRecord {
  return {
    id: 'onb-1',
    candidateId: CAND_ID,
    startDate: new Date('2026-10-10T00:00:00Z'),
    inductionScheduled: true,
    equipmentAssigned: true,
    responsibilityCardSigned: true,
    notarizedContractSigned: false,
    isCompleted: true,
    completedAt: new Date('2026-10-07T12:00:00Z'),
    probationPassed: null,
    probationEvaluation: null,
    probationEvaluatedAt: null,
    probationEvaluatedBy: null,
    probationMonthlyFee: null,
    postProbationMonthlySalary: null,
    probationFeeNotes: null,
    probationFeesRecordedAt: null,
    probationFeesRecordedBy: null,
    feesVisible: false,
    version: 1,
    completedBy: UID,
    createdAt: new Date('2026-10-07T12:00:00Z'),
    ...over,
  };
}

function setup(role: 'RRHH' | 'AUDITORIA' | 'ADMINISTRACION' | 'GERENCIA' = 'RRHH') {
  const access = new RecruitmentAccessService(buildWorkContext(role), buildMatrixAuth());
  const tm = buildTransactionManager();
  const clock = new FixedClock();
  const audit = { recordRecruitmentEvent: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<AuditEventRepositoryPort>;
  const outbox = { publish: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<OutboxEventRepositoryPort>;
  const candidates = {
    findScopedById: jest.fn(),
    findDetailById: jest.fn(),
    updateStage: jest.fn(),
    updateDecision: jest.fn(),
    updateProcessState: jest
      .fn()
      .mockImplementation(async (_id: string, _from: string, to: CandidateProcessState) => candidate({ processState: to })),
  } as unknown as jest.Mocked<CandidateRepositoryPort>;
  const vacancies = { findById: jest.fn(), updateStatus: jest.fn() } as unknown as jest.Mocked<VacancyRepositoryPort>;
  const onb = {
    complete: jest.fn(),
    findByCandidateId: jest.fn(),
    evaluateProbation: jest.fn(),
  } as unknown as jest.Mocked<OnboardingRepositoryPort>;
  return { access, tm, clock, audit, outbox, candidates, vacancies, onb };
}

describe('ChangeCandidateStageHandler', () => {
  const cmd = (stage: CandidateStage) =>
    new ChangeCandidateStageCommand(UID, CAND_ID, COMPANY_ID, BRANCH_ID, stage, 1);

  it('un rol de solo lectura (Auditoria) no puede mover candidatos de etapa', async () => {
    const s = setup('AUDITORIA');
    const handler = new ChangeCandidateStageHandler(s.access, s.candidates, s.tm, s.audit);
    await expect(handler.execute(cmd(CandidateStage.DECISION))).rejects.toBeInstanceOf(ForbiddenException);
    expect(s.candidates.updateStage).not.toHaveBeenCalled();
  });

  it('no permite retroceder la etapa', async () => {
    const s = setup();
    s.candidates.findScopedById.mockResolvedValue(candidate({ stage: CandidateStage.ENTREVISTA }));
    const handler = new ChangeCandidateStageHandler(s.access, s.candidates, s.tm, s.audit);
    await expect(handler.execute(cmd(CandidateStage.NUEVO))).rejects.toBeInstanceOf(CandidateStageRegressionError);
  });

  it('avanza de etapa y audita', async () => {
    const s = setup();
    s.candidates.findScopedById.mockResolvedValue(candidate({ stage: CandidateStage.CONTACTADO }));
    s.candidates.updateStage.mockResolvedValue(candidate({ stage: CandidateStage.ENTREVISTA, version: 2 }));
    const handler = new ChangeCandidateStageHandler(s.access, s.candidates, s.tm, s.audit);
    const result = await handler.execute(cmd(CandidateStage.ENTREVISTA));
    expect(result.stage).toBe(CandidateStage.ENTREVISTA);
    expect(s.audit.recordRecruitmentEvent).toHaveBeenCalledTimes(1);
  });
});

describe('DecideCandidateHandler', () => {
  const cmd = (decision: CandidateDecision) =>
    new DecideCandidateCommand(UID, CAND_ID, COMPANY_ID, BRANCH_ID, decision, 1, ' ok ');

  it('solo Gerencia/RRHH deciden (Administracion queda fuera, BR-REC-003)', async () => {
    const s = setup('ADMINISTRACION');
    const handler = new DecideCandidateHandler(s.access, s.candidates, s.tm, s.clock, s.audit, s.outbox, s.vacancies);
    await expect(handler.execute(cmd(CandidateDecision.CONTRATADO))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rechaza una segunda decision sobre el mismo candidato', async () => {
    const s = setup();
    s.candidates.findScopedById.mockResolvedValue(candidate({ decision: CandidateDecision.RECHAZADO }));
    const handler = new DecideCandidateHandler(s.access, s.candidates, s.tm, s.clock, s.audit, s.outbox, s.vacancies);
    await expect(handler.execute(cmd(CandidateDecision.CONTRATADO))).rejects.toBeInstanceOf(
      CandidateAlreadyDecidedError,
    );
    expect(s.candidates.updateDecision).not.toHaveBeenCalled();
  });

  it('CONTRATADO registra quien decidio y publica CandidatoSeleccionado', async () => {
    const s = setup();
    const decided = candidate({ decision: CandidateDecision.CONTRATADO, stage: CandidateStage.DECISION, version: 2 });
    s.candidates.findScopedById.mockResolvedValue(candidate());
    s.candidates.updateDecision.mockResolvedValue(decided);
    s.candidates.findDetailById.mockResolvedValue({ ...decided, isMechanic: false, interviews: [], negotiations: [], onboarding: null });
    const handler = new DecideCandidateHandler(s.access, s.candidates, s.tm, s.clock, s.audit, s.outbox, s.vacancies);
    await handler.execute(cmd(CandidateDecision.CONTRATADO));
    expect(s.candidates.updateDecision).toHaveBeenCalledWith(
      CAND_ID,
      CandidateDecision.CONTRATADO,
      'ok',
      UID,
      expect.any(Date),
      CandidateProcessState.DECIDIDO,
      1,
      s.tm.tx,
    );
    expect(s.outbox.publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'CandidatoSeleccionado.v1' }),
      s.tm.tx,
    );
  });

  it('RECHAZADO no publica evento de seleccion', async () => {
    const s = setup();
    const decided = candidate({ decision: CandidateDecision.RECHAZADO, stage: CandidateStage.DECISION, version: 2 });
    s.candidates.findScopedById.mockResolvedValue(candidate());
    s.candidates.updateDecision.mockResolvedValue(decided);
    s.candidates.findDetailById.mockResolvedValue({ ...decided, isMechanic: false, interviews: [], negotiations: [], onboarding: null });
    const handler = new DecideCandidateHandler(s.access, s.candidates, s.tm, s.clock, s.audit, s.outbox, s.vacancies);
    await handler.execute(cmd(CandidateDecision.RECHAZADO));
    expect(s.outbox.publish).not.toHaveBeenCalled();
  });
});

describe('CompleteOnboardingHandler', () => {
  const cmd = (over: Partial<{ ind: boolean; eq: boolean; card: boolean; notary: boolean }> = {}) =>
    new CompleteOnboardingCommand(
      UID,
      CAND_ID,
      COMPANY_ID,
      BRANCH_ID,
      new Date('2026-10-10T00:00:00Z'),
      over.ind ?? true,
      over.eq ?? true,
      over.card ?? true,
      over.notary ?? false,
    );

  const build = (s: ReturnType<typeof setup>) =>
    new CompleteOnboardingHandler(s.access, s.candidates, s.vacancies, s.onb, s.tm, s.clock, s.audit, s.outbox);

  it('exige que el candidato este CONTRATADO', async () => {
    const s = setup();
    s.candidates.findScopedById.mockResolvedValue(candidate({ decision: CandidateDecision.RECHAZADO }));
    await expect(build(s).execute(cmd())).rejects.toBeInstanceOf(CandidateNotContractedError);
  });

  it('exige el checklist completo', async () => {
    const s = setup();
    s.candidates.findScopedById.mockResolvedValue(candidate({ decision: CandidateDecision.CONTRATADO, processState: CandidateProcessState.DECIDIDO }));
    s.vacancies.findById.mockResolvedValue({ id: 'vac-1', isMechanic: false } as never);
    await expect(build(s).execute(cmd({ eq: false }))).rejects.toBeInstanceOf(OnboardingChecklistIncompleteError);
  });

  it('puesto mecanico sin contrato notariado es rechazado (BR-REC-009)', async () => {
    const s = setup();
    s.candidates.findScopedById.mockResolvedValue(candidate({ decision: CandidateDecision.CONTRATADO, processState: CandidateProcessState.DECIDIDO }));
    s.vacancies.findById.mockResolvedValue({ id: 'vac-1', isMechanic: true } as never);
    await expect(build(s).execute(cmd())).rejects.toBeInstanceOf(OnboardingMissingNotarizedContractError);
  });

  it('completa, registra completedBy y publica PersonalIncorporado', async () => {
    const s = setup();
    s.candidates.findScopedById.mockResolvedValue(candidate({ decision: CandidateDecision.CONTRATADO, processState: CandidateProcessState.DECIDIDO }));
    s.vacancies.findById.mockResolvedValue({ id: 'vac-1', isMechanic: true } as never);
    s.onb.complete.mockResolvedValue(onboarding({ notarizedContractSigned: true }));
    await build(s).execute(cmd({ notary: true }));
    expect(s.onb.complete).toHaveBeenCalledWith(expect.objectContaining({ completedBy: UID }), s.tm.tx);
    expect(s.outbox.publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'PersonalIncorporado.v1' }),
      s.tm.tx,
    );
  });
});

describe('EvaluateProbationHandler', () => {
  const cmd = (passed: boolean) => new EvaluateProbationCommand(UID, CAND_ID, COMPANY_ID, BRANCH_ID, passed, ' bien ');
  const build = (s: ReturnType<typeof setup>) =>
    new EvaluateProbationHandler(s.access, s.candidates, s.onb, s.tm, s.clock, s.audit, s.outbox);

  it('falla si no existe la incorporacion', async () => {
    const s = setup();
    s.candidates.findScopedById.mockResolvedValue(candidate({ processState: CandidateProcessState.PERIODO_PRUEBA }));
    s.onb.findByCandidateId.mockResolvedValue(null);
    await expect(build(s).execute(cmd(true))).rejects.toBeInstanceOf(OnboardingNotFoundError);
  });

  it('no permite evaluar dos veces', async () => {
    const s = setup();
    s.candidates.findScopedById.mockResolvedValue(candidate({ processState: CandidateProcessState.PERIODO_PRUEBA }));
    s.onb.findByCandidateId.mockResolvedValue(onboarding({ probationPassed: true }));
    await expect(build(s).execute(cmd(true))).rejects.toBeInstanceOf(ProbationAlreadyEvaluatedError);
  });

  it('aprobado: registra evaluatedBy y publica PasoAPlanilla', async () => {
    const s = setup();
    s.candidates.findScopedById.mockResolvedValue(candidate({ processState: CandidateProcessState.PERIODO_PRUEBA }));
    s.onb.findByCandidateId.mockResolvedValue(onboarding());
    s.onb.evaluateProbation.mockResolvedValue(onboarding({ probationPassed: true, probationEvaluation: 'bien' }));
    await build(s).execute(cmd(true));
    expect(s.onb.evaluateProbation).toHaveBeenCalledWith(
      CAND_ID,
      expect.objectContaining({ passed: true, qualitativeEvaluation: 'bien', evaluatedBy: UID }),
      s.tm.tx,
    );
    expect(s.outbox.publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'PasoAPlanilla.v1' }),
      s.tm.tx,
    );
  });

  it('no aprobado: no publica PasoAPlanilla', async () => {
    const s = setup('GERENCIA');
    s.candidates.findScopedById.mockResolvedValue(candidate({ processState: CandidateProcessState.PERIODO_PRUEBA }));
    s.onb.findByCandidateId.mockResolvedValue(onboarding());
    s.onb.evaluateProbation.mockResolvedValue(onboarding({ probationPassed: false }));
    await build(s).execute(cmd(false));
    expect(s.outbox.publish).not.toHaveBeenCalled();
  });
});
