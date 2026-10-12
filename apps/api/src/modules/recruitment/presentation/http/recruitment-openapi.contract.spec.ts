import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { $Enums } from '@prisma/client';
import * as yaml from 'js-yaml';
import { RECRUITMENT_ACTIONS } from '../../application/policies/recruitment-role-policy';
import {
  INTERVIEWERS_DEFAULT_LIMIT,
  INTERVIEWERS_MAX_LIMIT,
} from '../../application/queries/list-interviewers.query';
import { CANDIDATE_CV_MAX_BYTES } from '../../domain/recruitment-rules';
import { PERMISSION_ACTION_CATALOG } from '../../../admin/domain/permission-action-catalog';

const SPEC_PATH = path.resolve(__dirname, '../../../../../../../packages/contracts/openapi/recruitment.yaml');
const spec = yaml.load(fs.readFileSync(SPEC_PATH, 'utf8')) as any;

describe('recruitment.yaml contract specification', () => {
  it('el archivo de contrato existe y define titulo y version correctos', () => {
    expect(fs.existsSync(SPEC_PATH)).toBe(true);
    expect(spec.info.title).toBe('KAIROS ERP - Recruitment & Selection API');
    expect(spec.info.version).toBe('0.2.0');
  });

  it('los enums del contrato coinciden exactamente con los generados en Prisma Client', () => {
    const vacancySourcesInSpec = spec.components.schemas.VacancySource.enum.sort();
    const vacancySourcesInPrisma = Object.values($Enums.VacancySource).sort();
    expect(vacancySourcesInSpec).toEqual(vacancySourcesInPrisma);

    const vacancyStatusesInSpec = spec.components.schemas.VacancyStatus.enum.sort();
    const vacancyStatusesInPrisma = Object.values($Enums.VacancyStatus).sort();
    expect(vacancyStatusesInSpec).toEqual(vacancyStatusesInPrisma);

    const candidateStagesInSpec = spec.components.schemas.CandidateStage.enum.sort();
    const candidateStagesInPrisma = Object.values($Enums.CandidateStage).sort();
    expect(candidateStagesInSpec).toEqual(candidateStagesInPrisma);

    const candidateDecisionsInSpec = spec.components.schemas.CandidateDecision.enum.sort();
    const candidateDecisionsInPrisma = Object.values($Enums.CandidateDecision).sort();
    expect(candidateDecisionsInSpec).toEqual(candidateDecisionsInPrisma);

    const negotiationOutcomesInSpec = spec.components.schemas.NegotiationOutcome.enum.sort();
    const negotiationOutcomesInPrisma = Object.values($Enums.NegotiationOutcome).sort();
    expect(negotiationOutcomesInSpec).toEqual(negotiationOutcomesInPrisma);

    const interviewResultsInSpec = spec.components.schemas.InterviewResult.enum.sort();
    const interviewResultsInPrisma = Object.values($Enums.InterviewResult).sort();
    expect(interviewResultsInSpec).toEqual(interviewResultsInPrisma);
  });

  it('define todas las rutas REST y comandos CQRS previstos para REC-01..REC-08', () => {
    const paths = Object.keys(spec.paths).sort();
    expect(paths).toEqual([
      '/candidates/{id}',
      '/candidates/{id}/commands/change-stage',
      '/candidates/{id}/commands/complete-onboarding',
      '/candidates/{id}/commands/decide',
      '/candidates/{id}/commands/evaluate-probation',
      '/candidates/{id}/commands/record-cv',
      '/candidates/{id}/commands/set-probation-fees',
      '/candidates/{id}/cv',
      '/candidates/{id}/cv/upload-session',
      '/candidates/{id}/interviews',
      '/candidates/{id}/negotiations',
      '/interviewers',
      '/interviews/{id}/commands/record-result',
      '/vacancies',
      '/vacancies/{id}',
      '/vacancies/{id}/candidates',
      '/vacancies/{id}/commands/pause',
      '/vacancies/{id}/commands/publish',
      '/vacancies/{id}/commands/resume',
    ]);
  });

  it('CandidateDetailResponse expone isMechanic como campo obligatorio', () => {
    const detail = spec.components.schemas.CandidateDetailResponse.allOf[1];
    expect(detail.required).toContain('isMechanic');
    expect(detail.properties.isMechanic.type).toBe('boolean');
  });

  it('el contrato no expone puntajes automaticos (score) en candidatos (DR-REC-001 / BR-REC-006)', () => {
    const schemas = spec.components.schemas;
    expect(schemas.CandidateResponse.properties.score).toBeUndefined();
    expect(JSON.stringify(schemas.CandidateDetailResponse)).not.toContain('score');
  });

  it('GET /interviewers exige companyId y branchId, pagina con tope y responde solo id y fullName', () => {
    const op = spec.paths['/interviewers'].get;
    const param = (name: string) => op.parameters.find((p: any) => p.name === name && p.in === 'query');
    expect(param('companyId').required).toBe(true);
    expect(param('branchId').required).toBe(true);
    expect(param('q').required).toBe(false);
    expect(param('limit').schema.maximum).toBe(INTERVIEWERS_MAX_LIMIT);
    expect(param('limit').schema.default).toBe(INTERVIEWERS_DEFAULT_LIMIT);

    const schemas = spec.components.schemas;
    expect(op.responses['200'].content['application/json'].schema.$ref).toBe(
      '#/components/schemas/InterviewerListResponse',
    );
    expect(schemas.InterviewerListResponse.required).toEqual(['items']);
    expect(Object.keys(schemas.InterviewerResponse.properties).sort()).toEqual(['fullName', 'id']);
  });

  it('GET /vacancies/{id}/candidates (listCandidates) devuelve un array de CandidateResponse con stage opcional', () => {
    const op = spec.paths['/vacancies/{id}/candidates'].get;
    expect(op.operationId).toBe('listCandidates');
    const param = (name: string) => op.parameters.find((p: any) => p.name === name && p.in === 'query');
    expect(param('companyId').required).toBe(true);
    expect(param('branchId').required).toBe(true);
    expect(param('stage').required).toBe(false);
    const schema = op.responses['200'].content['application/json'].schema;
    expect(schema.type).toBe('array');
    expect(schema.items.$ref).toBe('#/components/schemas/CandidateResponse');
  });

  it('los comandos mutantes con concurrencia optimista exigen cabecera If-Match', () => {
    const mutatingWithIfMatch = [
      spec.paths['/vacancies/{id}/commands/publish'].post,
      spec.paths['/candidates/{id}/commands/change-stage'].post,
      spec.paths['/candidates/{id}/commands/decide'].post,
      spec.paths['/vacancies/{id}/commands/pause'].post,
      spec.paths['/vacancies/{id}/commands/resume'].post,
      spec.paths['/candidates/{id}/commands/record-cv'].post,
      spec.paths['/candidates/{id}/negotiations'].post,
      spec.paths['/candidates/{id}/commands/set-probation-fees'].post,
    ];

    for (const op of mutatingWithIfMatch) {
      const ifMatchParam = op.parameters?.find((p: any) => p.name === 'If-Match' && p.in === 'header');
      expect(ifMatchParam).toBeDefined();
      expect(ifMatchParam.required).toBe(true);
    }
  });

  it('pausar/reanudar usan el permiso de publicar y devuelven el detalle de la vacante', () => {
    for (const path of ['/vacancies/{id}/commands/pause', '/vacancies/{id}/commands/resume']) {
      const op = spec.paths[path].post;
      expect(op.responses['200'].content['application/json'].schema.$ref).toBe(
        '#/components/schemas/VacancyDetailResponse',
      );
      expect(op.responses['403'].description).toContain('PUBLISH_VACANCY');
      expect(op.responses['422']).toBeDefined();
    }
    expect(spec.components.schemas.VacancyStatus.enum).toContain('PAUSADA');
  });

  it('CV: la subida valida tipo y tamano, el visor exige datos sensibles y no hay URL firmada en la ficha', () => {
    const request = spec.components.schemas.RequestCandidateCvUploadSessionRequest;
    expect(request.properties.contentType.enum).toEqual([
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
    ]);
    expect(request.properties.contentLength.maximum).toBe(CANDIDATE_CV_MAX_BYTES);
    expect(request.required).toEqual(expect.arrayContaining(['contentType', 'contentLength']));

    const view = spec.paths['/candidates/{id}/cv'].get;
    expect(view.operationId).toBe('getCandidateCv');
    expect(view.responses['403'].description).toContain('VIEW_CANDIDATE_SENSITIVE_DATA');
    expect(view.responses['404']).toBeDefined();

    const detail = spec.components.schemas.CandidateDetailResponse.allOf[1];
    expect(detail.properties.hasCv.type).toBe('boolean');
    expect(JSON.stringify(spec.components.schemas.CandidateCvResponse)).not.toMatch(/objectUrl|"url"/);
    expect(spec.components.schemas.CandidateDetailResponse.allOf[1].required).toEqual(
      expect.arrayContaining(['hasCv', 'negotiations']),
    );
  });

  it('negociacion: historial en la ficha, resultado enum y sin campos de puntaje ni calculo', () => {
    const op = spec.paths['/candidates/{id}/negotiations'].post;
    expect(op.operationId).toBe('recordNegotiation');
    const idempotency = op.parameters.find((p: any) => p.name === 'Idempotency-Key' && p.in === 'header');
    expect(idempotency).toBeDefined();
    const request = spec.components.schemas.RecordNegotiationRequest;
    expect(request.required).toEqual(expect.arrayContaining(['outcome', 'offeredSalary']));
    expect(request.properties.outcome.$ref).toBe('#/components/schemas/NegotiationOutcome');
    const negotiation = JSON.stringify(spec.components.schemas.NegotiationResponse);
    expect(negotiation).not.toMatch(/score|suggest|balance/i);
  });

  it('honorarios: OnboardingResponse informa feesRestricted/version y el comando exige If-Match', () => {
    const response = spec.components.schemas.OnboardingResponse;
    expect(response.required).toEqual(expect.arrayContaining(['feesRestricted', 'version']));
    expect(response.properties.probationMonthlyFee.nullable).toBe(true);
    const request = spec.components.schemas.SetProbationFeesRequest;
    expect(request.required).toEqual(['companyId', 'branchId', 'probationMonthlyFee']);
    expect(request.properties.probationMonthlyFee.minimum).toBe(0);
    expect(spec.paths['/candidates/{id}/commands/set-probation-fees'].post.responses['403'].description).toContain(
      'datos sensibles',
    );
  });

  it('las 10 acciones del catálogo de permisos cubren todas las operaciones requeridas', () => {
    const catalogRecActions = PERMISSION_ACTION_CATALOG
      .filter((d) => d.module === 'RECRUITMENT')
      .map((d) => d.action)
      .sort();

    expect(catalogRecActions).toEqual([...RECRUITMENT_ACTIONS].sort());
    expect(catalogRecActions).toContain('VIEW_CANDIDATE_SENSITIVE_DATA');
    expect(catalogRecActions).toContain('DECIDE_CANDIDATE');
    expect(catalogRecActions).toContain('MANAGE_ONBOARDING');
    expect(catalogRecActions).toContain('EVALUATE_PROBATION');
  });
});
