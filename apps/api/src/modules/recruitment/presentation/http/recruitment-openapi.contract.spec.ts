import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { $Enums } from '@prisma/client';
import * as yaml from 'js-yaml';
import { RECRUITMENT_ACTIONS } from '../../application/policies/recruitment-role-policy';
import { PERMISSION_ACTION_CATALOG } from '../../../admin/domain/permission-action-catalog';

const SPEC_PATH = path.resolve(__dirname, '../../../../../../../packages/contracts/openapi/recruitment.yaml');
const spec = yaml.load(fs.readFileSync(SPEC_PATH, 'utf8')) as any;

describe('recruitment.yaml contract specification', () => {
  it('el archivo de contrato existe y define titulo y version correctos', () => {
    expect(fs.existsSync(SPEC_PATH)).toBe(true);
    expect(spec.info.title).toBe('KAIROS ERP - Recruitment & Selection API');
    expect(spec.info.version).toBe('0.1.0');
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
      '/candidates/{id}/interviews',
      '/interviews/{id}/commands/record-result',
      '/vacancies',
      '/vacancies/{id}',
      '/vacancies/{id}/candidates',
      '/vacancies/{id}/commands/publish',
    ]);
  });

  it('los comandos mutantes con concurrencia optimista exigen cabecera If-Match', () => {
    const mutatingWithIfMatch = [
      spec.paths['/vacancies/{id}/commands/publish'].post,
      spec.paths['/candidates/{id}/commands/change-stage'].post,
      spec.paths['/candidates/{id}/commands/decide'].post,
    ];

    for (const op of mutatingWithIfMatch) {
      const ifMatchParam = op.parameters?.find((p: any) => p.name === 'If-Match' && p.in === 'header');
      expect(ifMatchParam).toBeDefined();
      expect(ifMatchParam.required).toBe(true);
    }
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
