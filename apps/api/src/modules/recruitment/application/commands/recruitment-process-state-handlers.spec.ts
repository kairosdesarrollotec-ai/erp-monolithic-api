import { CandidateDecision, CandidateStage, InterviewResult } from '@prisma/client';
import type { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import type { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import { CandidateProcessState as PS, VacancyStatus as VS } from '../../domain/recruitment-domain-types';
import {
  CandidateRequirementsIncompleteError,
  CandidateStateTransitionError,
  DecisionReasonRequiredError,
  GerenciaDecisionRequiredError,
  OnboardingAlreadyCompletedError,
} from '../../domain/recruitment-errors';
import {
  BRANCH_ID,
  COMPANY_ID,
  FixedClock,
  ORG_ID,
  buildMatrixAuth,
  buildTransactionManager,
  buildWorkContext,
} from '../../testing/recruitment-test-fixtures';
import type { CandidateRecord, CandidateRepositoryPort } from '../ports/candidate-repository.port';
import type { InterviewRepositoryPort } from '../ports/interview-repository.port';
import type { OnboardingRecord, OnboardingRepositoryPort } from '../ports/onboarding-repository.port';
import type { VacancyRecord, VacancyRepositoryPort } from '../ports/vacancy-repository.port';
import { RecruitmentAccessService } from '../services/recruitment-access.service';
import { CompleteOnboardingCommand } from './complete-onboarding.command';
import { CompleteOnboardingHandler } from './complete-onboarding.handler';
import { DecideCandidateCommand } from './decide-candidate.command';
import { DecideCandidateHandler } from './decide-candidate.handler';
import { EvaluateProbationCommand } from './evaluate-probation.command';
import { EvaluateProbationHandler } from './evaluate-probation.handler';
import { RecordInterviewResultCommand } from './record-interview-result.command';
import { RecordInterviewResultHandler } from './record-interview-result.handler';
import { RegisterCandidateCommand } from './register-candidate.command';
import { RegisterCandidateHandler } from './register-candidate.handler';

/** BDD-REC-001 §11.6 - flujo de estados de Reclutamiento y Selección, extremo a extremo por comando. */

const UID = 'uid-1';
const VAC_ID = 'vac-1';
const CAND_ID = 'cand-1';

function vacancy(over: Partial<VacancyRecord> = {}): VacancyRecord {
  return {
    id: VAC_ID,
    organizationId: ORG_ID,
    operatingCompanyId: COMPANY_ID,
    branchId: BRANCH_ID,
    code: 'VAC-2026-0001',
    title: 'Asesor',
    department: 'Ventas',
    source: 'CRECIMIENTO',
    status: VS.PUBLICADA,
    isMechanic: false,
    profileDescription: 'Perfil',
    baseSalary: 2000,
    scheduleDetails: 'L-S',
    publishedChannels: ['Facebook'],
    version: 4,
    createdAt: new Date('2026-10-01T00:00:00Z'),
    updatedAt: new Date('2026-10-01T00:00:00Z'),
    createdBy: UID,
    ...over,
  } as VacancyRecord;
}

function candidate(over: Partial<CandidateRecord> = {}): CandidateRecord {
  return {
    id: CAND_ID,
    vacancyId: VAC_ID,
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
    processState: PS.EN_NEGOCIACION,
    processStateChangedAt: null,
    decision: null,
    decisionNotes: null,
    decidedBy: null,
    decidedAt: null,
    version: 2,
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

function setup(role: 'RRHH' | 'GERENCIA' | 'ADMINISTRACION' = 'RRHH') {
  const access = new RecruitmentAccessService(buildWorkContext(role), buildMatrixAuth());
  const tm = buildTransactionManager();
  const clock = new FixedClock();
  const audit = { recordRecruitmentEvent: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<AuditEventRepositoryPort>;
  const outbox = { publish: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<OutboxEventRepositoryPort>;
  const candidates = {
    findScopedById: jest.fn(),
    findDetailById: jest.fn(),
    findByDocumentNumber: jest.fn().mockResolvedValue(null),
    create: jest.fn(),
    updateDecision: jest.fn(),
    updateProcessState: jest
      .fn()
      .mockImplementation(async (_id: string, _from: PS, to: PS) => candidate({ processState: to })),
  } as unknown as jest.Mocked<CandidateRepositoryPort>;
  const vacancies = {
    findById: jest.fn().mockResolvedValue(vacancy()),
    updateStatus: jest
      .fn()
      .mockImplementation(async (_id: string, status: VS, version: number) => vacancy({ status, version: version + 1 })),
  } as unknown as jest.Mocked<VacancyRepositoryPort>;
  const interviews = {
    findScopedById: jest.fn(),
    recordResult: jest.fn(),
  } as unknown as jest.Mocked<InterviewRepositoryPort>;
  const onb = {
    complete: jest.fn(),
    findByCandidateId: jest.fn(),
    evaluateProbation: jest.fn(),
  } as unknown as jest.Mocked<OnboardingRepositoryPort>;
  return { access, tm, clock, audit, outbox, candidates, vacancies, interviews, onb };
}

type S = ReturnType<typeof setup>;
const auditedActions = (s: S) => s.audit.recordRecruitmentEvent.mock.calls.map(([e]) => e.action);
const processTransitions = (s: S) =>
  s.candidates.updateProcessState.mock.calls.map(([, from, to]) => `${from}>${to}`);

describe('Registrar candidato: Publicado -> En negociación (OP-REC-002)', () => {
  const run = async (s: S) => {
    s.candidates.create.mockResolvedValue(candidate({ stage: CandidateStage.NUEVO }));
    const h = new RegisterCandidateHandler(s.access, s.vacancies, s.candidates, s.tm, s.audit);
    await h.execute(new RegisterCandidateCommand(UID, VAC_ID, COMPANY_ID, BRANCH_ID, 'Ana Perez', 'DNI', '12345678', undefined));
  };

  it('el primer candidato lleva la vacante PUBLICADA a EN_NEGOCIACION usando su versión y audita', async () => {
    const s = setup();
    await run(s);
    expect(s.vacancies.updateStatus).toHaveBeenCalledWith(VAC_ID, VS.EN_NEGOCIACION, 4, s.tm.tx);
    expect(auditedActions(s)).toEqual(['CANDIDATE_REGISTERED', 'VACANCY_PROGRESSED']);
    expect(s.audit.recordRecruitmentEvent).toHaveBeenLastCalledWith(
      expect.objectContaining({
        entityType: 'vacancy',
        changes: expect.objectContaining({ fromStatus: VS.PUBLICADA, toStatus: VS.EN_NEGOCIACION, trigger: 'CANDIDATE_REGISTERED' }),
      }),
      s.tm.tx,
    );
  });

  it.each([VS.EN_NEGOCIACION, VS.ENTREVISTADA, VS.DECIDIDA, VS.PAUSADA, VS.CANCELADA, VS.NECESIDAD_REGISTRADA])(
    'una vacante %s no cambia de estado al registrar otro candidato',
    async (status) => {
      const s = setup();
      s.vacancies.findById.mockResolvedValue(vacancy({ status }));
      await run(s);
      expect(s.vacancies.updateStatus).not.toHaveBeenCalled();
      expect(auditedActions(s)).toEqual(['CANDIDATE_REGISTERED']);
    },
  );
});

describe('Registrar resultado de entrevista: En negociación -> Entrevistado', () => {
  const cmd = (result: InterviewResult = InterviewResult.AVANZA) =>
    new RecordInterviewResultCommand(UID, 'int-1', COMPANY_ID, BRANCH_ID, result, ' notas ');
  const build = (s: S) =>
    new RecordInterviewResultHandler(s.access, s.candidates, s.interviews, s.tm, s.clock, s.audit, s.vacancies);
  const prep = (s: S, state: PS) => {
    s.interviews.findScopedById.mockResolvedValue({ id: 'int-1', candidateId: CAND_ID } as never);
    s.candidates.findScopedById.mockResolvedValue(candidate({ processState: state, hasCv: true, salaryExpectation: 2500 }));
    s.interviews.recordResult.mockResolvedValue({ id: 'int-1', candidateId: CAND_ID } as never);
  };

  it('DEC-REC-REQUIREMENTS-001: sin CV o sin pretensión salarial -> 422 CANDIDATE_REQUIREMENTS_INCOMPLETE', async () => {
    const s = setup();
    s.interviews.findScopedById.mockResolvedValue({ id: 'int-1', candidateId: CAND_ID } as never);
    s.candidates.findScopedById.mockResolvedValue(candidate({ processState: PS.EN_NEGOCIACION, hasCv: false, salaryExpectation: 2500 }));
    await expect(build(s).execute(cmd())).rejects.toThrow(CandidateRequirementsIncompleteError);

    s.candidates.findScopedById.mockResolvedValue(candidate({ processState: PS.EN_NEGOCIACION, hasCv: true, salaryExpectation: null }));
    await expect(build(s).execute(cmd())).rejects.toThrow(CandidateRequirementsIncompleteError);
  });

  it('pasa el candidato a ENTREVISTADO y la vacante a ENTREVISTADA', async () => {
    const s = setup();
    prep(s, PS.EN_NEGOCIACION);
    s.vacancies.findById.mockResolvedValue(vacancy({ status: VS.EN_NEGOCIACION }));
    await build(s).execute(cmd());
    expect(processTransitions(s)).toEqual(['EN_NEGOCIACION>ENTREVISTADO']);
    expect(s.vacancies.updateStatus).toHaveBeenCalledWith(VAC_ID, VS.ENTREVISTADA, 4, s.tm.tx);
    expect(auditedActions(s)).toEqual(['INTERVIEW_RESULT_RECORDED', 'CANDIDATE_PROCESS_STATE_CHANGED', 'VACANCY_PROGRESSED']);
  });

  it('NO_AVANZA también cuenta como entrevista realizada y NO descarta ni decide al candidato', async () => {
    const s = setup('GERENCIA');
    prep(s, PS.EN_NEGOCIACION);
    await build(s).execute(cmd(InterviewResult.NO_AVANZA));
    expect(processTransitions(s)).toEqual(['EN_NEGOCIACION>ENTREVISTADO']);
    expect(s.candidates.updateDecision).not.toHaveBeenCalled();
  });

  it.each(['RRHH', 'ADMINISTRACION'] as const)('«No avanza» lo decide solo Gerencia: %s recibe 403 y no se escribe nada', async (role) => {
    const s = setup(role);
    prep(s, PS.EN_NEGOCIACION);
    const err = await build(s).execute(cmd(InterviewResult.NO_AVANZA)).catch((e) => e);
    expect(err).toBeInstanceOf(GerenciaDecisionRequiredError);
    expect(err.httpStatus).toBe(403);
    expect(err.code).toBe('ROLE_NOT_ALLOWED');
    expect(s.interviews.recordResult).not.toHaveBeenCalled();
  });

  it('«Avanza» sigue pudiendo registrarlo RRHH', async () => {
    const s = setup('RRHH');
    prep(s, PS.EN_NEGOCIACION);
    await build(s).execute(cmd(InterviewResult.AVANZA));
    expect(s.interviews.recordResult).toHaveBeenCalled();
  });

  it('una segunda entrevista de un candidato ya ENTREVISTADO no repite la transición', async () => {
    const s = setup();
    prep(s, PS.ENTREVISTADO);
    await build(s).execute(cmd());
    expect(s.candidates.updateProcessState).not.toHaveBeenCalled();
    expect(s.vacancies.updateStatus).not.toHaveBeenCalled();
  });
});

describe('Decidir: Entrevistado -> Decidido | Descartado', () => {
  const cmd = (decision: CandidateDecision, notes: string | undefined = 'ok') =>
    new DecideCandidateCommand(UID, CAND_ID, COMPANY_ID, BRANCH_ID, decision, 2, notes);
  const build = (s: S) => new DecideCandidateHandler(s.access, s.candidates, s.tm, s.clock, s.audit, s.outbox, s.vacancies);
  const prep = (s: S, state: PS, status: VS = VS.ENTREVISTADA) => {
    s.candidates.findScopedById.mockResolvedValue(candidate({ processState: state }));
    s.vacancies.findById.mockResolvedValue(vacancy({ status }));
    s.candidates.updateDecision.mockImplementation(async (_id, decision, _n, _by, _at, processState) =>
      candidate({ decision, processState, stage: CandidateStage.DECISION, version: 3 }),
    );
    s.candidates.findDetailById.mockResolvedValue({
      ...candidate({ processState: state }),
      isMechanic: false,
      interviews: [],
      negotiations: [],
      onboarding: null,
    });
  };

  it('CONTRATADO desde ENTREVISTADO: candidato DECIDIDO, vacante DECIDIDA, evento y auditoría', async () => {
    const s = setup();
    prep(s, PS.ENTREVISTADO);
    await build(s).execute(cmd(CandidateDecision.CONTRATADO));
    expect(s.candidates.updateDecision).toHaveBeenCalledWith(
      CAND_ID, CandidateDecision.CONTRATADO, 'ok', UID, expect.any(Date), PS.DECIDIDO, 2, s.tm.tx,
    );
    expect(s.vacancies.updateStatus).toHaveBeenCalledWith(VAC_ID, VS.DECIDIDA, 4, s.tm.tx);
    expect(s.outbox.publish).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'CandidatoSeleccionado.v1' }), s.tm.tx);
    expect(s.audit.recordRecruitmentEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CANDIDATE_PROCESS_STATE_CHANGED',
        changes: expect.objectContaining({ fromState: PS.ENTREVISTADO, toState: PS.DECIDIDO }),
      }),
      s.tm.tx,
    );
  });

  it('CONTRATADO sin entrevista registrada se rechaza con CANDIDATE_STATE_TRANSITION_INVALID y no escribe nada', async () => {
    const s = setup();
    prep(s, PS.EN_NEGOCIACION);
    await expect(build(s).execute(cmd(CandidateDecision.CONTRATADO))).rejects.toBeInstanceOf(CandidateStateTransitionError);
    expect(s.candidates.updateDecision).not.toHaveBeenCalled();
    expect(s.vacancies.updateStatus).not.toHaveBeenCalled();
    expect(s.outbox.publish).not.toHaveBeenCalled();
  });

  it('RECHAZADO tras la entrevista: candidato DESCARTADO (vía Decidido), vacante NO cambia y sin evento', async () => {
    const s = setup();
    prep(s, PS.ENTREVISTADO);
    await build(s).execute(cmd(CandidateDecision.RECHAZADO));
    expect(s.candidates.updateDecision).toHaveBeenCalledWith(
      CAND_ID, CandidateDecision.RECHAZADO, 'ok', UID, expect.any(Date), PS.DESCARTADO, 2, s.tm.tx,
    );
    expect(s.audit.recordRecruitmentEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        changes: expect.objectContaining({ fromState: PS.ENTREVISTADO, toState: PS.DESCARTADO, via: ['DECIDIDO', 'DESCARTADO'] }),
      }),
      s.tm.tx,
    );
    expect(s.vacancies.updateStatus).not.toHaveBeenCalled();
    expect(s.outbox.publish).not.toHaveBeenCalled();
  });

  it('RECHAZADO sin entrevista (candidato no continúa) pasa de EN_NEGOCIACION a DESCARTADO', async () => {
    const s = setup();
    prep(s, PS.EN_NEGOCIACION);
    await build(s).execute(cmd(CandidateDecision.RECHAZADO));
    expect(s.candidates.updateDecision).toHaveBeenCalledWith(
      CAND_ID, CandidateDecision.RECHAZADO, 'ok', UID, expect.any(Date), PS.DESCARTADO, 2, s.tm.tx,
    );
  });
});

describe('Incorporar: Decidido -> Ingresado -> Periodo de prueba', () => {
  const cmd = () =>
    new CompleteOnboardingCommand(UID, CAND_ID, COMPANY_ID, BRANCH_ID, new Date('2026-10-10T00:00:00Z'), true, true, true, false);
  const build = (s: S) =>
    new CompleteOnboardingHandler(s.access, s.candidates, s.vacancies, s.onb, s.tm, s.clock, s.audit, s.outbox);
  const prep = (s: S, state: PS) => {
    s.candidates.findScopedById.mockResolvedValue(candidate({ processState: state, decision: CandidateDecision.CONTRATADO }));
    s.onb.complete.mockResolvedValue(onboarding());
  };

  it('recorre INGRESADO y PERIODO_PRUEBA en orden, audita ambos pasos y publica PersonalIncorporado', async () => {
    const s = setup();
    prep(s, PS.DECIDIDO);
    await build(s).execute(cmd());
    expect(processTransitions(s)).toEqual(['DECIDIDO>INGRESADO', 'INGRESADO>PERIODO_PRUEBA']);
    expect(auditedActions(s).filter((a) => a === 'CANDIDATE_PROCESS_STATE_CHANGED')).toHaveLength(2);
    expect(s.outbox.publish).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'PersonalIncorporado.v1' }), s.tm.tx);
  });

  it.each([PS.INGRESADO, PS.PERIODO_PRUEBA, PS.PLANILLA, PS.TERMINADO])(
    'incorporación repetida (%s): 409 ONBOARDING_ALREADY_COMPLETED y no se escribe nada (Respuestas #16)',
    async (state) => {
      const s = setup();
      prep(s, state);
      const err = await build(s).execute(cmd()).catch((e) => e);
      expect(err).toBeInstanceOf(OnboardingAlreadyCompletedError);
      expect(err.httpStatus).toBe(409);
      expect(err.code).toBe('ONBOARDING_ALREADY_COMPLETED');
      expect(s.onb.complete).not.toHaveBeenCalled();
      expect(s.outbox.publish).not.toHaveBeenCalled();
    },
  );

  it('Ingresado y Periodo de prueba son UN solo paso: una llamada recorre ambos y deja PERIODO_PRUEBA (Respuestas #11)', async () => {
    const s = setup();
    prep(s, PS.DECIDIDO);
    await build(s).execute(cmd());
    expect(processTransitions(s).at(-1)).toBe('INGRESADO>PERIODO_PRUEBA');
    expect(s.onb.complete).toHaveBeenCalledTimes(1);
  });

  it.each([PS.ENTREVISTADO])(
    'un candidato en %s no puede incorporarse y no se escribe la incorporación',
    async (state) => {
      const s = setup();
      prep(s, state);
      await expect(build(s).execute(cmd())).rejects.toBeInstanceOf(CandidateStateTransitionError);
      expect(s.onb.complete).not.toHaveBeenCalled();
      expect(s.outbox.publish).not.toHaveBeenCalled();
    },
  );
});

describe('Evaluar periodo de prueba: Periodo de prueba -> Planilla | Terminado', () => {
  const cmd = (passed: boolean) => new EvaluateProbationCommand(UID, CAND_ID, COMPANY_ID, BRANCH_ID, passed, ' bien ');
  const build = (s: S) => new EvaluateProbationHandler(s.access, s.candidates, s.onb, s.tm, s.clock, s.audit, s.outbox);
  const prep = (s: S, state: PS) => {
    s.candidates.findScopedById.mockResolvedValue(candidate({ processState: state }));
    s.onb.findByCandidateId.mockResolvedValue(onboarding());
    s.onb.evaluateProbation.mockResolvedValue(onboarding({ probationPassed: true }));
  };

  it('evaluación positiva: PLANILLA y evento PasoAPlanilla', async () => {
    const s = setup();
    prep(s, PS.PERIODO_PRUEBA);
    await build(s).execute(cmd(true));
    expect(processTransitions(s)).toEqual(['PERIODO_PRUEBA>PLANILLA']);
    expect(s.outbox.publish).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'PasoAPlanilla.v1' }), s.tm.tx);
  });

  it('evaluación negativa: TERMINADO y evento RelacionLaboralTerminada.v1 (la registra Gerencia; P4), sin PasoAPlanilla', async () => {
    const s = setup('GERENCIA');
    prep(s, PS.PERIODO_PRUEBA);
    await build(s).execute(cmd(false));
    expect(processTransitions(s)).toEqual(['PERIODO_PRUEBA>TERMINADO']);
    expect(s.outbox.publish).toHaveBeenCalledTimes(1);
    expect(s.outbox.publish).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'RelacionLaboralTerminada.v1' }), s.tm.tx);
  });

  it.each(['RRHH', 'ADMINISTRACION'] as const)('prueba negativa: el término lo registra solo Gerencia, %s recibe 403', async (role) => {
    const s = setup(role);
    prep(s, PS.PERIODO_PRUEBA);
    const err = await build(s).execute(cmd(false)).catch((e) => e);
    // ADMINISTRACION ni siquiera tiene EVALUATE_PROBATION (ForbiddenException); RRHH cae en la regla de Gerencia.
    expect(err.status ?? err.httpStatus).toBe(403);
    if (role === 'RRHH') expect(err).toBeInstanceOf(GerenciaDecisionRequiredError);
    expect(s.onb.evaluateProbation).not.toHaveBeenCalled();
    expect(s.candidates.updateProcessState).not.toHaveBeenCalled();
  });

  it('prueba positiva: RRHH sí puede pasar a planilla', async () => {
    const s = setup('RRHH');
    prep(s, PS.PERIODO_PRUEBA);
    await build(s).execute(cmd(true));
    expect(processTransitions(s)).toEqual(['PERIODO_PRUEBA>PLANILLA']);
  });

  it.each([PS.DECIDIDO, PS.INGRESADO, PS.PLANILLA, PS.TERMINADO])(
    'un candidato en %s no se puede evaluar y no se escribe la evaluación',
    async (state) => {
      const s = setup();
      prep(s, state);
      await expect(build(s).execute(cmd(true))).rejects.toBeInstanceOf(CandidateStateTransitionError);
      expect(s.onb.evaluateProbation).not.toHaveBeenCalled();
    },
  );
});

describe('Respuestas de negocio 2026-10-20 (frente B): candidatos en vacantes pausadas/canceladas y motivo de descarte', () => {
  it.each([VS.PAUSADA, VS.CANCELADA])(
    'se puede registrar un candidato en una vacante %s: se crea y la vacante NO cambia de estado (#15)',
    async (status) => {
      const s = setup();
      s.vacancies.findById.mockResolvedValue(vacancy({ status }));
      s.candidates.create.mockResolvedValue(candidate({ stage: CandidateStage.NUEVO }));
      const h = new RegisterCandidateHandler(s.access, s.vacancies, s.candidates, s.tm, s.audit);
      await expect(
        h.execute(new RegisterCandidateCommand(UID, VAC_ID, COMPANY_ID, BRANCH_ID, 'Ana Perez', 'DNI', '12345678', undefined)),
      ).resolves.toBeDefined();
      expect(s.candidates.create).toHaveBeenCalled();
      expect(s.vacancies.updateStatus).not.toHaveBeenCalled();
    },
  );

  const decide = (s: S, state: PS, notes: string | undefined | null) => {
    s.candidates.findScopedById.mockResolvedValue(candidate({ processState: state }));
    s.vacancies.findById.mockResolvedValue(vacancy({ status: VS.ENTREVISTADA }));
    s.candidates.updateDecision.mockImplementation(async (_id, decision, _n, _by, _at, processState) =>
      candidate({ decision, processState, stage: CandidateStage.DECISION, version: 3 }),
    );
    s.candidates.findDetailById.mockResolvedValue({
      ...candidate({ processState: state }), isMechanic: false, interviews: [], negotiations: [], onboarding: null,
    });
    const h = new DecideCandidateHandler(s.access, s.candidates, s.tm, s.clock, s.audit, s.outbox, s.vacancies);
    return h.execute(new DecideCandidateCommand(UID, CAND_ID, COMPANY_ID, BRANCH_ID, CandidateDecision.RECHAZADO, 2, notes));
  };

  it.each([undefined, null, '', '   '])('rechazo tras la entrevista sin motivo (%p) -> 422 DECISION_REASON_REQUIRED y no escribe (#14)', async (notes) => {
    const s = setup();
    const err = await decide(s, PS.ENTREVISTADO, notes as never).catch((e) => e);
    expect(err).toBeInstanceOf(DecisionReasonRequiredError);
    expect(err.httpStatus).toBe(422);
    expect(err.code).toBe('DECISION_REASON_REQUIRED');
    expect(s.candidates.updateDecision).not.toHaveBeenCalled();
  });

  it('rechazo tras la entrevista con motivo -> DESCARTADO', async () => {
    const s = setup();
    await decide(s, PS.ENTREVISTADO, ' rechazó la oferta ');
    expect(s.candidates.updateDecision).toHaveBeenCalledWith(
      CAND_ID, CandidateDecision.RECHAZADO, 'rechazó la oferta', UID, expect.any(Date), PS.DESCARTADO, 2, s.tm.tx,
    );
  });

  it('rechazo ANTES de la entrevista no exige motivo (no cambia lo existente)', async () => {
    const s = setup();
    await expect(decide(s, PS.EN_NEGOCIACION, undefined)).resolves.toBeDefined();
  });
});
