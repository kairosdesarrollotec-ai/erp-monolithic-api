import { ForbiddenException } from '@nestjs/common';
import { CandidateStage } from '@prisma/client';
import {
  BRANCH_ID,
  COMPANY_ID,
  RECRUITMENT_SCOPE,
  buildMatrixAuth,
  buildWorkContext,
} from '../../testing/recruitment-test-fixtures';
import { VacancyNotFoundError } from '../../domain/recruitment-errors';
import { RecruitmentAccessService } from '../services/recruitment-access.service';
import type { CandidateRecord, CandidateRepositoryPort } from '../ports/candidate-repository.port';
import type { VacancyRepositoryPort } from '../ports/vacancy-repository.port';
import { toCandidateResponse } from '../../presentation/http/recruitment.mapper';
import { ListCandidatesHandler } from './list-candidates.handler';
import { ListCandidatesQuery } from './list-candidates.query';

const UID = 'uid-1';
const VAC_ID = 'vac-1';

function candidate(id: string, stage: CandidateStage): CandidateRecord {
  return {
    id,
    vacancyId: VAC_ID,
    fullName: `Candidato ${id}`,
    documentType: 'DNI',
    documentNumber: '12345678',
    email: 'secreto@example.com',
    phone: '999111222',
    cvDocumentId: null,
    salaryExpectation: 3000,
    stage,
    decision: null,
    decisionNotes: null,
    decidedBy: null,
    decidedAt: null,
    version: 1,
    createdAt: new Date('2026-10-01T00:00:00Z'),
    updatedAt: new Date('2026-10-01T00:00:00Z'),
  };
}

function setup(role: 'RRHH' | 'FRONT_OFFICE' = 'RRHH') {
  const access = new RecruitmentAccessService(buildWorkContext(role), buildMatrixAuth());
  const vacancies = { findById: jest.fn().mockResolvedValue({ id: VAC_ID }) } as unknown as jest.Mocked<VacancyRepositoryPort>;
  const candidates = {
    listByVacancy: jest.fn().mockResolvedValue([
      candidate('a', CandidateStage.NUEVO),
      candidate('b', CandidateStage.ENTREVISTA),
      candidate('c', CandidateStage.NUEVO),
    ]),
  } as unknown as jest.Mocked<CandidateRepositoryPort>;
  return { handler: new ListCandidatesHandler(access, vacancies, candidates), vacancies, candidates };
}

const q = (stage?: CandidateStage) => new ListCandidatesQuery(UID, VAC_ID, COMPANY_ID, BRANCH_ID, stage);

describe('ListCandidatesHandler', () => {
  it('exige VIEW_CANDIDATE (Front Office recibe 403)', async () => {
    const s = setup('FRONT_OFFICE');
    await expect(s.handler.execute(q())).rejects.toBeInstanceOf(ForbiddenException);
    expect(s.vacancies.findById).not.toHaveBeenCalled();
  });

  it('404 VACANCY_NOT_FOUND si la vacante no existe en el ambito', async () => {
    const s = setup();
    s.vacancies.findById.mockResolvedValue(null);
    const err = await s.handler.execute(q()).catch((e) => e);
    expect(err).toBeInstanceOf(VacancyNotFoundError);
    expect(err.code).toBe('VACANCY_NOT_FOUND');
    expect(s.vacancies.findById).toHaveBeenCalledWith(VAC_ID, RECRUITMENT_SCOPE);
    expect(s.candidates.listByVacancy).not.toHaveBeenCalled();
  });

  it('devuelve todos los candidatos sin filtro de etapa', async () => {
    const s = setup();
    expect((await s.handler.execute(q())).map((c) => c.id)).toEqual(['a', 'b', 'c']);
  });

  it('filtra por etapa cuando viene stage', async () => {
    const s = setup();
    expect((await s.handler.execute(q(CandidateStage.NUEVO))).map((c) => c.id)).toEqual(['a', 'c']);
    expect(await s.handler.execute(q(CandidateStage.DECISION))).toEqual([]);
  });

  it('la respuesta HTTP no incluye datos sensibles ni score', async () => {
    const s = setup();
    const [first] = await s.handler.execute(q());
    const response = toCandidateResponse(first) as unknown as Record<string, unknown>;
    for (const key of ['email', 'phone', 'salaryExpectation', 'cvDocumentId', 'score']) {
      expect(response).not.toHaveProperty(key);
    }
  });
});
