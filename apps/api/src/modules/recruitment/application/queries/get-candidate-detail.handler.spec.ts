import { ForbiddenException } from '@nestjs/common';
import { CandidateStage } from '@prisma/client';
import {
  BRANCH_ID,
  COMPANY_ID,
  buildMatrixAuth,
  buildWorkContext,
} from '../../testing/recruitment-test-fixtures';
import { CandidateNotFoundError } from '../../domain/recruitment-errors';
import { RecruitmentAccessService } from '../services/recruitment-access.service';
import type { CandidateDetailRecord, CandidateRepositoryPort } from '../ports/candidate-repository.port';
import { toCandidateDetailResponse } from '../../presentation/http/recruitment.mapper';
import { GetCandidateDetailHandler } from './get-candidate-detail.handler';
import { GetCandidateDetailQuery } from './get-candidate-detail.query';

const UID = 'uid-1';
const CAND_ID = 'cand-1';

function detail(over: Partial<CandidateDetailRecord> = {}): CandidateDetailRecord {
  return {
    id: CAND_ID,
    vacancyId: 'vac-1',
    fullName: 'Ana Perez',
    documentType: 'DNI',
    documentNumber: '12345678',
    email: 'ana@example.com',
    phone: '999111222',
    cvDocumentId: null,
    cv: null,
    hasCv: false,
    salaryExpectation: 2500,
    stage: CandidateStage.ENTREVISTA,
    processState: 'EN_NEGOCIACION',
    processStateChangedAt: null,
    decision: null,
    decisionNotes: null,
    decidedBy: null,
    decidedAt: null,
    version: 1,
    createdAt: new Date('2026-10-01T00:00:00Z'),
    updatedAt: new Date('2026-10-01T00:00:00Z'),
    isMechanic: true,
    interviews: [],
    negotiations: [],
    onboarding: null,
    ...over,
  };
}

function setup(role: 'RRHH' | 'AUDITORIA' | 'FRONT_OFFICE' = 'RRHH') {
  const access = new RecruitmentAccessService(buildWorkContext(role), buildMatrixAuth());
  const candidates = { findDetailById: jest.fn() } as unknown as jest.Mocked<CandidateRepositoryPort>;
  return { handler: new GetCandidateDetailHandler(access, candidates), candidates };
}

const query = new GetCandidateDetailQuery(UID, CAND_ID, COMPANY_ID, BRANCH_ID);

describe('GetCandidateDetailHandler', () => {
  it('rechaza roles sin VIEW_CANDIDATE', async () => {
    const s = setup('FRONT_OFFICE');
    await expect(s.handler.execute(query)).rejects.toBeInstanceOf(ForbiddenException);
    expect(s.candidates.findDetailById).not.toHaveBeenCalled();
  });

  it('404 de dominio si el candidato no existe', async () => {
    const s = setup();
    s.candidates.findDetailById.mockResolvedValue(null);
    await expect(s.handler.execute(query)).rejects.toBeInstanceOf(CandidateNotFoundError);
  });

  it('expone isMechanic de la vacante del candidato en el detalle', async () => {
    const s = setup();
    s.candidates.findDetailById.mockResolvedValue(detail({ isMechanic: true }));
    const result = await s.handler.execute(query);
    expect(result.isMechanic).toBe(true);
    expect(toCandidateDetailResponse(result).isMechanic).toBe(true);

    s.candidates.findDetailById.mockResolvedValue(detail({ isMechanic: false }));
    const other = await s.handler.execute(query);
    expect(toCandidateDetailResponse(other).isMechanic).toBe(false);
  });

  it('la vista restringida (Auditoria) conserva isMechanic', async () => {
    const s = setup('AUDITORIA');
    s.candidates.findDetailById.mockResolvedValue(detail({ isMechanic: true }));
    const result = await s.handler.execute(query);
    expect(result.isRestrictedView).toBe(true);
    expect(toCandidateDetailResponse(result).isMechanic).toBe(true);
  });
});
