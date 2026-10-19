import { ForbiddenException } from '@nestjs/common';
import { CandidateDecision, CandidateStage, NegotiationOutcome, VacancyStatus } from '@prisma/client';
import type { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import {
  CandidateAlreadyDecidedError,
  CandidateCvInvalidFileError,
  CandidateCvNotFoundError,
  CandidateCvNotUploadedError,
  CandidateCvObjectMismatchError,
  CandidateNotFoundError,
  CandidateVersionConflictError,
  NegotiationInvalidError,
  OnboardingNotFoundError,
  ProbationAlreadyEvaluatedError,
  VacancyNotFoundError,
  VacancyNotPausableError,
} from '../../domain/recruitment-errors';
import {
  BRANCH_ID,
  COMPANY_ID,
  FixedClock,
  ORG_ID,
  RECRUITMENT_SCOPE,
  buildMatrixAuth,
  buildTransactionManager,
  buildWorkContext,
} from '../../testing/recruitment-test-fixtures';
import { RecruitmentAccessService } from '../services/recruitment-access.service';
import type { CandidateCvStoragePort } from '../ports/candidate-cv-storage.port';
import type { CandidateDetailRecord, CandidateRecord, CandidateRepositoryPort } from '../ports/candidate-repository.port';
import type { OnboardingRecord, OnboardingRepositoryPort } from '../ports/onboarding-repository.port';
import type { VacancyRecord, VacancyRepositoryPort } from '../ports/vacancy-repository.port';
import { GetCandidateCvHandler } from '../queries/get-candidate-cv.handler';
import { GetCandidateCvQuery } from '../queries/get-candidate-cv.query';
import { RegisterCandidateCommand } from './register-candidate.command';
import { RegisterCandidateHandler } from './register-candidate.handler';
import { PauseVacancyCommand } from './pause-vacancy.command';
import { PauseVacancyHandler } from './pause-vacancy.handler';
import { RecordCandidateCvCommand } from './record-candidate-cv.command';
import { RecordCandidateCvHandler } from './record-candidate-cv.handler';
import { RecordNegotiationCommand } from './record-negotiation.command';
import { RecordNegotiationHandler } from './record-negotiation.handler';
import { RequestCandidateCvUploadSessionCommand } from './request-candidate-cv-upload-session.command';
import { RequestCandidateCvUploadSessionHandler } from './request-candidate-cv-upload-session.handler';
import { ResumeVacancyCommand } from './resume-vacancy.command';
import { ResumeVacancyHandler } from './resume-vacancy.handler';
import { SetProbationFeesCommand } from './set-probation-fees.command';
import { SetProbationFeesHandler } from './set-probation-fees.handler';

const UID = 'uid-1';
const CAND_ID = 'cand-1';
const VAC_ID = 'vac-1';
const PDF = 'application/pdf';
const OBJECT_URL = `https://storage.googleapis.com/bucket/candidate-cvs/${COMPANY_ID}/${CAND_ID}/0b9f2a3e-1c2d-4e5f-8a9b-0c1d2e3f4a5b.pdf`;

function vacancy(over: Partial<VacancyRecord> = {}): VacancyRecord {
  return {
    id: VAC_ID,
    organizationId: ORG_ID,
    operatingCompanyId: COMPANY_ID,
    branchId: BRANCH_ID,
    code: 'VAC-2026-0001',
    title: 'Mecánico',
    department: 'Taller',
    source: 'CRECIMIENTO',
    status: VacancyStatus.PUBLICADA,
    isMechanic: true,
    profileDescription: 'Perfil de prueba',
    baseSalary: 3200,
    scheduleDetails: 'L-S',
    publishedChannels: ['SENATI'],
    version: 2,
    createdAt: new Date('2026-10-01T00:00:00Z'),
    updatedAt: new Date('2026-10-01T00:00:00Z'),
    createdBy: UID,
    ...over,
  };
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
    stage: CandidateStage.CONTACTADO,
    processState: 'EN_NEGOCIACION',
    processStateChangedAt: null,
    decision: null,
    decisionNotes: null,
    decidedBy: null,
    decidedAt: null,
    version: 3,
    createdAt: new Date('2026-10-01T00:00:00Z'),
    updatedAt: new Date('2026-10-01T00:00:00Z'),
    ...over,
  };
}

function detailOf(c: CandidateRecord): CandidateDetailRecord {
  return { ...c, isMechanic: true, interviews: [], negotiations: [], onboarding: null };
}

function onboarding(over: Partial<OnboardingRecord> = {}): OnboardingRecord {
  return {
    id: 'onb-1',
    candidateId: CAND_ID,
    startDate: new Date('2026-10-10T00:00:00Z'),
    inductionScheduled: true,
    equipmentAssigned: true,
    responsibilityCardSigned: true,
    notarizedContractSigned: true,
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

type Role = 'RRHH' | 'AUDITORIA' | 'ADMINISTRACION' | 'FINANZAS' | 'CAMPO';

function setup(role: Role = 'RRHH') {
  const access = new RecruitmentAccessService(buildWorkContext(role), buildMatrixAuth());
  const tm = buildTransactionManager();
  const clock = new FixedClock();
  const audit = { recordRecruitmentEvent: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<AuditEventRepositoryPort>;
  const vacancies = {
    findById: jest.fn(),
    findDetailById: jest.fn(),
    updateStatus: jest.fn(),
  } as unknown as jest.Mocked<VacancyRepositoryPort>;
  const candidates = {
    findScopedById: jest.fn(),
    findDetailById: jest.fn(),
    setCv: jest.fn(),
    addNegotiation: jest.fn(),
    updateStage: jest.fn(),
  } as unknown as jest.Mocked<CandidateRepositoryPort>;
  const onb = {
    findByCandidateId: jest.fn(),
    setProbationFees: jest.fn(),
  } as unknown as jest.Mocked<OnboardingRepositoryPort>;
  const storage = {
    generateSignedUploadUrl: jest.fn(),
    isOwnedObjectUrl: jest.fn().mockReturnValue(true),
    getObjectMetadata: jest.fn(),
    generateSignedReadUrl: jest.fn(),
  } as unknown as jest.Mocked<CandidateCvStoragePort>;
  return { access, tm, clock, audit, vacancies, candidates, onb, storage };
}

describe('PauseVacancyHandler / ResumeVacancyHandler (REC-02 Pausar)', () => {
  const pause = (reason?: string) => new PauseVacancyCommand(UID, VAC_ID, COMPANY_ID, BRANCH_ID, 2, reason);
  const resume = () => new ResumeVacancyCommand(UID, VAC_ID, COMPANY_ID, BRANCH_ID, 3);

  it('pausa una vacante PUBLICADA con If-Match, audita y registra el motivo', async () => {
    const s = setup();
    const paused = vacancy({ status: VacancyStatus.PAUSADA, version: 3 });
    s.vacancies.findById.mockResolvedValue(vacancy());
    s.vacancies.updateStatus.mockResolvedValue(paused);
    s.vacancies.findDetailById.mockResolvedValue({
      ...paused,
      candidatesCount: 0,
      candidatesByStage: { NUEVO: 0, CONTACTADO: 0, ENTREVISTA: 0, DECISION: 0 },
    });
    const handler = new PauseVacancyHandler(s.access, s.vacancies, s.tm, s.audit);

    const result = await handler.execute(pause('  Esperando presupuesto  '));

    expect(result.status).toBe(VacancyStatus.PAUSADA);
    expect(s.vacancies.updateStatus).toHaveBeenCalledWith(VAC_ID, VacancyStatus.PAUSADA, 2, s.tm.tx);
    expect(s.audit.recordRecruitmentEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'vacancy',
        action: 'VACANCY_PAUSED',
        changes: expect.objectContaining({ fromStatus: 'PUBLICADA', toStatus: 'PAUSADA', reason: 'Esperando presupuesto' }),
      }),
      s.tm.tx,
    );
  });

  it.each([
    VacancyStatus.NECESIDAD_REGISTRADA,
    VacancyStatus.PAUSADA,
    VacancyStatus.EN_NEGOCIACION,
    VacancyStatus.DECIDIDA,
    VacancyStatus.CANCELADA,
  ])('no permite pausar una vacante en estado %s', async (status) => {
    const s = setup();
    s.vacancies.findById.mockResolvedValue(vacancy({ status }));
    const handler = new PauseVacancyHandler(s.access, s.vacancies, s.tm, s.audit);
    await expect(handler.execute(pause())).rejects.toBeInstanceOf(VacancyNotPausableError);
    expect(s.vacancies.updateStatus).not.toHaveBeenCalled();
  });

  it('un rol sin PUBLISH_VACANCY (Administracion) no puede pausar ni reanudar', async () => {
    const s = setup('ADMINISTRACION');
    await expect(new PauseVacancyHandler(s.access, s.vacancies, s.tm, s.audit).execute(pause())).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(new ResumeVacancyHandler(s.access, s.vacancies, s.tm, s.audit).execute(resume())).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(s.vacancies.updateStatus).not.toHaveBeenCalled();
  });

  it('vacante inexistente en el alcance responde no encontrada', async () => {
    const s = setup();
    s.vacancies.findById.mockResolvedValue(null);
    await expect(new PauseVacancyHandler(s.access, s.vacancies, s.tm, s.audit).execute(pause())).rejects.toBeInstanceOf(
      VacancyNotFoundError,
    );
  });

  it('reanuda una vacante PAUSADA y audita VACANCY_RESUMED', async () => {
    const s = setup();
    const resumed = vacancy({ status: VacancyStatus.PUBLICADA, version: 4 });
    s.vacancies.findById.mockResolvedValue(vacancy({ status: VacancyStatus.PAUSADA, version: 3 }));
    s.vacancies.updateStatus.mockResolvedValue(resumed);
    s.vacancies.findDetailById.mockResolvedValue({
      ...resumed,
      candidatesCount: 0,
      candidatesByStage: { NUEVO: 0, CONTACTADO: 0, ENTREVISTA: 0, DECISION: 0 },
    });
    const handler = new ResumeVacancyHandler(s.access, s.vacancies, s.tm, s.audit);

    const result = await handler.execute(resume());

    expect(result.status).toBe(VacancyStatus.PUBLICADA);
    expect(s.vacancies.updateStatus).toHaveBeenCalledWith(VAC_ID, VacancyStatus.PUBLICADA, 3, s.tm.tx);
    expect(s.audit.recordRecruitmentEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'VACANCY_RESUMED' }),
      s.tm.tx,
    );
  });

  it('no permite reanudar una vacante que no esta pausada', async () => {
    const s = setup();
    s.vacancies.findById.mockResolvedValue(vacancy({ status: VacancyStatus.PUBLICADA }));
    await expect(new ResumeVacancyHandler(s.access, s.vacancies, s.tm, s.audit).execute(resume())).rejects.toBeInstanceOf(
      VacancyNotPausableError,
    );
  });
});

describe('CV del candidato (DAT-REC-004)', () => {
  const sessionCmd = (contentType = PDF, contentLength = 1024) =>
    new RequestCandidateCvUploadSessionCommand(UID, CAND_ID, COMPANY_ID, BRANCH_ID, contentType, contentLength);

  it('firma la subida solo para un candidato del alcance y con tipo y tamano validos', async () => {
    const s = setup();
    s.candidates.findScopedById.mockResolvedValue(candidate());
    s.storage.generateSignedUploadUrl.mockResolvedValue({
      uploadUrl: 'https://signed/put',
      objectUrl: OBJECT_URL,
      expiresAt: new Date('2026-10-12T12:15:00Z'),
      uploadHeaders: { 'Content-Type': PDF },
    });
    const handler = new RequestCandidateCvUploadSessionHandler(s.access, s.candidates, s.storage);

    const session = await handler.execute(sessionCmd());

    expect(s.candidates.findScopedById).toHaveBeenCalledWith(CAND_ID, RECRUITMENT_SCOPE);
    expect(s.storage.generateSignedUploadUrl).toHaveBeenCalledWith({
      companyId: COMPANY_ID,
      candidateId: CAND_ID,
      contentType: PDF,
      maxBytes: 10 * 1024 * 1024,
    });
    expect(session.objectUrl).toBe(OBJECT_URL);
  });

  it.each([
    ['tipo ejecutable', 'application/x-msdownload', 1024],
    ['archivo vacio', PDF, 0],
    ['mas de 10 MB', PDF, 10 * 1024 * 1024 + 1],
  ])('rechaza antes de firmar: %s', async (_label, type, size) => {
    const s = setup();
    const handler = new RequestCandidateCvUploadSessionHandler(s.access, s.candidates, s.storage);
    await expect(handler.execute(sessionCmd(type, size))).rejects.toBeInstanceOf(CandidateCvInvalidFileError);
    expect(s.storage.generateSignedUploadUrl).not.toHaveBeenCalled();
  });

  it('un candidato de otra empresa o sede responde no encontrado y no firma nada', async () => {
    const s = setup();
    s.candidates.findScopedById.mockResolvedValue(null);
    const handler = new RequestCandidateCvUploadSessionHandler(s.access, s.candidates, s.storage);
    await expect(handler.execute(sessionCmd())).rejects.toBeInstanceOf(CandidateNotFoundError);
    expect(s.storage.generateSignedUploadUrl).not.toHaveBeenCalled();
  });

  it('un rol de solo lectura (Auditoria) no puede subir CV', async () => {
    const s = setup('AUDITORIA');
    const handler = new RequestCandidateCvUploadSessionHandler(s.access, s.candidates, s.storage);
    await expect(handler.execute(sessionCmd())).rejects.toBeInstanceOf(ForbiddenException);
  });

  describe('record-cv', () => {
    const recordCmd = (url = OBJECT_URL, name = 'CV Ana.pdf') =>
      new RecordCandidateCvCommand(UID, CAND_ID, COMPANY_ID, BRANCH_ID, url, name, 3);

    function recordSetup(role: Role = 'RRHH') {
      const s = setup(role);
      const base = candidate();
      const withCv = candidate({
        version: 4,
        hasCv: true,
        cv: {
          objectUrl: OBJECT_URL,
          fileName: 'CV Ana.pdf',
          contentType: PDF,
          sizeBytes: 2048,
          uploadedAt: new Date('2026-10-07T12:00:00Z'),
          uploadedBy: UID,
        },
      });
      s.candidates.findScopedById.mockResolvedValue(base);
      s.candidates.setCv.mockResolvedValue(withCv);
      s.candidates.findDetailById.mockResolvedValue(detailOf(withCv));
      s.storage.getObjectMetadata.mockResolvedValue({ sizeBytes: 2048, contentType: PDF });
      const handler = new RecordCandidateCvHandler(s.access, s.candidates, s.storage, s.tm, s.clock, s.audit);
      return { s, handler };
    }

    it('verifica el objeto real, registra el CV con If-Match y audita', async () => {
      const { s, handler } = recordSetup();
      const detail = await handler.execute(recordCmd());

      expect(s.storage.isOwnedObjectUrl).toHaveBeenCalledWith(OBJECT_URL, { companyId: COMPANY_ID, candidateId: CAND_ID });
      expect(s.candidates.setCv).toHaveBeenCalledWith(
        CAND_ID,
        expect.objectContaining({
          objectUrl: OBJECT_URL,
          fileName: 'CV Ana.pdf',
          contentType: PDF,
          sizeBytes: 2048,
          uploadedBy: UID,
        }),
        3,
        s.tm.tx,
      );
      expect(s.audit.recordRecruitmentEvent).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CANDIDATE_CV_UPLOADED' }),
        s.tm.tx,
      );
      expect(detail.hasCv).toBe(true);
      expect(detail.isRestrictedView).toBe(false);
    });

    it('usa el tipo y tamano reales del almacenamiento, no los que declara el cliente', async () => {
      const { s, handler } = recordSetup();
      s.storage.getObjectMetadata.mockResolvedValue({ sizeBytes: 50 * 1024 * 1024, contentType: PDF });
      await expect(handler.execute(recordCmd())).rejects.toBeInstanceOf(CandidateCvInvalidFileError);
      s.storage.getObjectMetadata.mockResolvedValue({ sizeBytes: 100, contentType: 'text/html' });
      await expect(handler.execute(recordCmd())).rejects.toBeInstanceOf(CandidateCvInvalidFileError);
      expect(s.candidates.setCv).not.toHaveBeenCalled();
    });

    it('rechaza un objeto que no fue generado para este candidato/empresa', async () => {
      const { s, handler } = recordSetup();
      s.storage.isOwnedObjectUrl.mockReturnValue(false);
      await expect(handler.execute(recordCmd('https://evil.example/x.pdf'))).rejects.toBeInstanceOf(
        CandidateCvObjectMismatchError,
      );
      expect(s.storage.getObjectMetadata).not.toHaveBeenCalled();
    });

    it('rechaza si el archivo nunca llego al almacenamiento', async () => {
      const { s, handler } = recordSetup();
      s.storage.getObjectMetadata.mockResolvedValue(null);
      await expect(handler.execute(recordCmd())).rejects.toBeInstanceOf(CandidateCvNotUploadedError);
    });

    it('sanea el nombre de archivo (sin rutas)', async () => {
      const { s, handler } = recordSetup();
      await handler.execute(recordCmd(OBJECT_URL, '..\\..\\etc/CV final.pdf'));
      expect(s.candidates.setCv).toHaveBeenCalledWith(
        CAND_ID,
        expect.objectContaining({ fileName: 'CV final.pdf' }),
        3,
        s.tm.tx,
      );
    });

    it('un usuario sin datos sensibles recibe la ficha restringida (sin cv ni negociacion)', async () => {
      const { s, handler } = recordSetup('ADMINISTRACION');
      const detail = await handler.execute(recordCmd());
      expect(detail.isRestrictedView).toBe(true);
      expect(detail.cv).toBeNull();
      expect(detail.hasCv).toBe(true);
      expect(s.candidates.setCv).toHaveBeenCalled();
    });
  });

  describe('visor (GET cv)', () => {
    const query = () => new GetCandidateCvQuery(UID, CAND_ID, COMPANY_ID, BRANCH_ID);
    const withCv = candidate({
      hasCv: true,
      cv: {
        objectUrl: OBJECT_URL,
        fileName: 'CV Ana.pdf',
        contentType: PDF,
        sizeBytes: 2048,
        uploadedAt: new Date('2026-10-07T12:00:00Z'),
        uploadedBy: UID,
      },
    });

    it('entrega una URL firmada de lectura y audita cada consulta', async () => {
      const s = setup();
      s.candidates.findScopedById.mockResolvedValue(withCv);
      s.storage.generateSignedReadUrl.mockResolvedValue({ url: 'https://signed/get', expiresAt: new Date('2026-10-12T12:05:00Z') });
      const handler = new GetCandidateCvHandler(s.access, s.candidates, s.storage, s.audit);

      const view = await handler.execute(query());

      expect(view.url).toBe('https://signed/get');
      expect(s.storage.generateSignedReadUrl).toHaveBeenCalledWith(OBJECT_URL, { fileName: 'CV Ana.pdf', contentType: PDF });
      expect(s.audit.recordRecruitmentEvent).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CANDIDATE_CV_VIEWED', entityId: CAND_ID }),
      );
    });

    it.each(['ADMINISTRACION', 'AUDITORIA'] as const)(
      'el rol %s no tiene permiso de datos sensibles: no se firma ninguna URL',
      async (role) => {
        const s = setup(role);
        s.candidates.findScopedById.mockResolvedValue(withCv);
        const handler = new GetCandidateCvHandler(s.access, s.candidates, s.storage, s.audit);
        await expect(handler.execute(query())).rejects.toBeInstanceOf(ForbiddenException);
        expect(s.storage.generateSignedReadUrl).not.toHaveBeenCalled();
        expect(s.audit.recordRecruitmentEvent).not.toHaveBeenCalled();
      },
    );

    it('Finanzas (datos sensibles) si puede ver el CV', async () => {
      const s = setup('FINANZAS');
      s.candidates.findScopedById.mockResolvedValue(withCv);
      s.storage.generateSignedReadUrl.mockResolvedValue({ url: 'https://signed/get', expiresAt: new Date() });
      const handler = new GetCandidateCvHandler(s.access, s.candidates, s.storage, s.audit);
      await expect(handler.execute(query())).resolves.toEqual(expect.objectContaining({ fileName: 'CV Ana.pdf' }));
    });

    it('sin CV cargado responde 404 especifico', async () => {
      const s = setup();
      s.candidates.findScopedById.mockResolvedValue(candidate());
      const handler = new GetCandidateCvHandler(s.access, s.candidates, s.storage, s.audit);
      await expect(handler.execute(query())).rejects.toBeInstanceOf(CandidateCvNotFoundError);
    });

    it('candidato fuera del alcance: no encontrado', async () => {
      const s = setup();
      s.candidates.findScopedById.mockResolvedValue(null);
      const handler = new GetCandidateCvHandler(s.access, s.candidates, s.storage, s.audit);
      await expect(handler.execute(query())).rejects.toBeInstanceOf(CandidateNotFoundError);
    });
  });
});

describe('RecordNegotiationHandler (REC-04 condiciones)', () => {
  const base = {
    outcome: NegotiationOutcome.EN_CURSO as NegotiationOutcome,
    offeredSalary: 3200,
    candidateSalary: 3500 as number | undefined,
    agreedSalary: undefined as number | undefined,
    reason: undefined as string | undefined,
  };
  const cmd = (over: Partial<typeof base> = {}, version = 3) => {
    const v = { ...base, ...over };
    return new RecordNegotiationCommand(
      UID, CAND_ID, COMPANY_ID, BRANCH_ID, version, v.outcome, v.offeredSalary,
      '  L-S 07:30-16:30 ', undefined, v.candidateSalary, undefined, undefined, undefined, v.agreedSalary, undefined, v.reason,
    );
  };

  function negSetup(role: Role = 'RRHH', cand: Partial<CandidateRecord> = {}) {
    const s = setup(role);
    const current = candidate(cand);
    s.candidates.findScopedById.mockResolvedValue(current);
    s.candidates.addNegotiation.mockImplementation(async (input) => ({
      id: 'neg-1',
      candidateId: input.candidateId,
      offeredSalary: input.offeredSalary,
      offeredSchedule: input.offeredSchedule ?? null,
      offeredOtherConditions: null,
      candidateSalary: input.candidateSalary ?? null,
      candidateSchedule: null,
      candidateOtherConditions: null,
      candidateStartDate: null,
      outcome: input.outcome,
      agreedSalary: input.agreedSalary ?? null,
      agreedConditions: null,
      reason: input.reason ?? null,
      recordedBy: input.recordedBy,
      createdAt: new Date('2026-10-07T12:00:00Z'),
    }));
    s.candidates.updateStage.mockResolvedValue(candidate({ stage: CandidateStage.ENTREVISTA, version: 4 }));
    s.candidates.findDetailById.mockResolvedValue(detailOf(current));
    const handler = new RecordNegotiationHandler(s.access, s.candidates, s.tm, s.audit);
    return { s, handler };
  }

  it('EN_CURSO guarda la anotacion sin mover la etapa y audita', async () => {
    const { s, handler } = negSetup();
    await handler.execute(cmd());
    expect(s.candidates.addNegotiation).toHaveBeenCalledWith(
      expect.objectContaining({ candidateId: CAND_ID, offeredSchedule: 'L-S 07:30-16:30', recordedBy: UID }),
      s.tm.tx,
    );
    expect(s.candidates.updateStage).not.toHaveBeenCalled();
    expect(s.audit.recordRecruitmentEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'NEGOTIATION_RECORDED' }),
      s.tm.tx,
    );
  });

  it('ACORDADA avanza a ENTREVISTA con la version vigente y audita ambos eventos', async () => {
    const { s, handler } = negSetup();
    await handler.execute(cmd({ outcome: NegotiationOutcome.ACORDADA, agreedSalary: 3350 }));
    expect(s.candidates.updateStage).toHaveBeenCalledWith(CAND_ID, CandidateStage.ENTREVISTA, 3, s.tm.tx);
    const actions = s.audit.recordRecruitmentEvent.mock.calls.map(([event]) => event.action);
    expect(actions).toEqual(['NEGOTIATION_RECORDED', 'CANDIDATE_STAGE_CHANGED']);
  });

  it('ACORDADA no retrocede ni repite la etapa si el candidato ya esta en ENTREVISTA', async () => {
    const { s, handler } = negSetup('RRHH', { stage: CandidateStage.ENTREVISTA });
    await handler.execute(cmd({ outcome: NegotiationOutcome.ACORDADA, agreedSalary: 3350 }));
    expect(s.candidates.updateStage).not.toHaveBeenCalled();
  });

  it('ACORDADA exige sueldo acordado y NO_ACORDADA exige motivo', async () => {
    const { s, handler } = negSetup();
    await expect(handler.execute(cmd({ outcome: NegotiationOutcome.ACORDADA }))).rejects.toBeInstanceOf(NegotiationInvalidError);
    await expect(handler.execute(cmd({ outcome: NegotiationOutcome.NO_ACORDADA, reason: '   ' }))).rejects.toBeInstanceOf(
      NegotiationInvalidError,
    );
    await expect(handler.execute(cmd({ outcome: NegotiationOutcome.EN_CURSO, agreedSalary: 3000 }))).rejects.toBeInstanceOf(
      NegotiationInvalidError,
    );
    expect(s.candidates.addNegotiation).not.toHaveBeenCalled();
  });

  it('NO_ACORDADA con motivo se registra y no mueve la etapa', async () => {
    const { s, handler } = negSetup();
    await handler.execute(cmd({ outcome: NegotiationOutcome.NO_ACORDADA, reason: 'Pretensión fuera de presupuesto' }));
    expect(s.candidates.addNegotiation).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'NO_ACORDADA', reason: 'Pretensión fuera de presupuesto' }),
      s.tm.tx,
    );
    expect(s.candidates.updateStage).not.toHaveBeenCalled();
  });

  it('montos negativos se rechazan', async () => {
    const { handler } = negSetup();
    await expect(handler.execute(cmd({ offeredSalary: -1 }))).rejects.toBeInstanceOf(NegotiationInvalidError);
    await expect(handler.execute(cmd({ candidateSalary: -5 }))).rejects.toBeInstanceOf(NegotiationInvalidError);
  });

  it('If-Match desactualizado responde conflicto de version y no escribe', async () => {
    const { s, handler } = negSetup();
    await expect(handler.execute(cmd({}, 2))).rejects.toBeInstanceOf(CandidateVersionConflictError);
    expect(s.candidates.addNegotiation).not.toHaveBeenCalled();
  });

  it('un candidato ya decidido no admite nuevas rondas', async () => {
    const { s, handler } = negSetup('RRHH', { decision: CandidateDecision.RECHAZADO });
    await expect(handler.execute(cmd())).rejects.toBeInstanceOf(CandidateAlreadyDecidedError);
    expect(s.candidates.addNegotiation).not.toHaveBeenCalled();
  });

  it('Administracion (registra candidatos pero no ve datos sensibles) no puede negociar', async () => {
    const { s, handler } = negSetup('ADMINISTRACION');
    await expect(handler.execute(cmd())).rejects.toBeInstanceOf(ForbiddenException);
    expect(s.candidates.addNegotiation).not.toHaveBeenCalled();
  });

  it('Finanzas (ve datos sensibles pero no registra candidatos) no puede negociar', async () => {
    const { handler } = negSetup('FINANZAS');
    await expect(handler.execute(cmd())).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('candidato fuera del alcance: no encontrado', async () => {
    const { s, handler } = negSetup();
    s.candidates.findScopedById.mockResolvedValue(null);
    await expect(handler.execute(cmd())).rejects.toBeInstanceOf(CandidateNotFoundError);
  });
});

describe('SetProbationFeesHandler (REC-08 honorarios)', () => {
  const cmd = (fee = 3350, version = 1) =>
    new SetProbationFeesCommand(UID, CAND_ID, COMPANY_ID, BRANCH_ID, version, fee, 3500, '  Guardias S/ 80  ');

  function feesSetup(role: Role = 'RRHH', onboardingOver: Partial<OnboardingRecord> = {}) {
    const s = setup(role);
    s.candidates.findScopedById.mockResolvedValue(candidate({ decision: CandidateDecision.CONTRATADO }));
    s.onb.findByCandidateId.mockResolvedValue(onboarding(onboardingOver));
    s.onb.setProbationFees.mockImplementation(async (_id, input, _version) =>
      onboarding({
        probationMonthlyFee: input.probationMonthlyFee,
        postProbationMonthlySalary: input.postProbationMonthlySalary,
        probationFeeNotes: input.probationFeeNotes,
        probationFeesRecordedAt: input.recordedAt,
        probationFeesRecordedBy: input.recordedBy,
        version: 2,
      }),
    );
    const handler = new SetProbationFeesHandler(s.access, s.candidates, s.onb, s.tm, s.clock, s.audit);
    return { s, handler };
  }

  it('registra los honorarios con If-Match, devuelve el dato visible y audita antes/despues', async () => {
    const { s, handler } = feesSetup('RRHH', { probationMonthlyFee: 3000 });
    const result = await handler.execute(cmd());

    expect(s.onb.setProbationFees).toHaveBeenCalledWith(
      CAND_ID,
      expect.objectContaining({
        probationMonthlyFee: 3350,
        postProbationMonthlySalary: 3500,
        probationFeeNotes: 'Guardias S/ 80',
        recordedBy: UID,
      }),
      1,
      s.tm.tx,
    );
    expect(result.feesVisible).toBe(true);
    expect(result.probationMonthlyFee).toBe(3350);
    expect(s.audit.recordRecruitmentEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'onboarding',
        action: 'PROBATION_FEES_RECORDED',
        changes: expect.objectContaining({
          previous: { probationMonthlyFee: 3000, postProbationMonthlySalary: null },
          probationMonthlyFee: 3350,
        }),
      }),
      s.tm.tx,
    );
  });

  it('no permite registrar honorarios despues de evaluar la prueba', async () => {
    const { s, handler } = feesSetup('RRHH', { probationPassed: true });
    await expect(handler.execute(cmd())).rejects.toBeInstanceOf(ProbationAlreadyEvaluatedError);
    expect(s.onb.setProbationFees).not.toHaveBeenCalled();
  });

  it('sin incorporacion registrada responde no encontrada', async () => {
    const { s, handler } = feesSetup();
    s.onb.findByCandidateId.mockResolvedValue(null);
    await expect(handler.execute(cmd())).rejects.toBeInstanceOf(OnboardingNotFoundError);
  });

  it('monto negativo se rechaza antes de tocar datos', async () => {
    const { s, handler } = feesSetup();
    await expect(handler.execute(cmd(-10))).rejects.toBeInstanceOf(NegotiationInvalidError);
    expect(s.onb.setProbationFees).not.toHaveBeenCalled();
  });

  it.each(['ADMINISTRACION', 'FINANZAS', 'AUDITORIA'] as const)(
    'el rol %s no puede registrar honorarios (requiere evaluar prueba + datos sensibles)',
    async (role) => {
      const { s, handler } = feesSetup(role);
      await expect(handler.execute(cmd())).rejects.toBeInstanceOf(ForbiddenException);
      expect(s.onb.setProbationFees).not.toHaveBeenCalled();
    },
  );

  it('candidato fuera del alcance: no encontrado', async () => {
    const { s, handler } = feesSetup();
    s.candidates.findScopedById.mockResolvedValue(null);
    await expect(handler.execute(cmd())).rejects.toBeInstanceOf(CandidateNotFoundError);
  });
});

describe('RegisterCandidateHandler (CV ya no se referencia por codigo pegado)', () => {
  it('sin cvDocumentId el servidor asigna un codigo interno y el CV se sube despues', async () => {
    const s = setup();
    s.vacancies.findById.mockResolvedValue(vacancy());
    s.vacancies.updateStatus.mockResolvedValue(vacancy({ status: VacancyStatus.EN_NEGOCIACION, version: 3 }));
    (s.candidates as unknown as { findByDocumentNumber: jest.Mock }).findByDocumentNumber = jest.fn().mockResolvedValue(null);
    (s.candidates as unknown as { create: jest.Mock }).create = jest.fn().mockResolvedValue(candidate({ stage: CandidateStage.NUEVO }));
    const handler = new RegisterCandidateHandler(s.access, s.vacancies, s.candidates, s.tm, s.audit);

    await handler.execute(
      new RegisterCandidateCommand(UID, VAC_ID, COMPANY_ID, BRANCH_ID, 'Ana Perez', 'DNI', '12345678', undefined),
    );

    expect((s.candidates as unknown as { create: jest.Mock }).create).toHaveBeenCalledWith(
      expect.objectContaining({
        cvDocumentId: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/),
      }),
      s.tm.tx,
    );
  });
});
