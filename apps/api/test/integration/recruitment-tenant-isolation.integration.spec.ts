import { randomUUID } from 'crypto';
import { ensureSystemRoles } from '../../src/modules/admin/infrastructure/persistence/system-roles-seeder';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../../src/common/persistence/prisma.service';
import { PrismaTransactionManager } from '../../src/common/persistence/prisma-transaction-manager';
import { PrismaVacancyRepository } from '../../src/modules/recruitment/infrastructure/persistence/prisma-vacancy.repository';
import { PrismaCandidateRepository } from '../../src/modules/recruitment/infrastructure/persistence/prisma-candidate.repository';
import { PrismaOutboxEventRepository } from '../../src/modules/outbox/infrastructure/persistence/prisma-outbox-event.repository';
import { WorkContextAuthorizationService } from '../../src/modules/users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../src/modules/authorization/matrix-authorization.service';
import { RecruitmentAccessService } from '../../src/modules/recruitment/application/services/recruitment-access.service';
import { RegisterVacancyHandler } from '../../src/modules/recruitment/application/commands/register-vacancy.handler';
import { RegisterVacancyCommand } from '../../src/modules/recruitment/application/commands/register-vacancy.command';
import { ListVacanciesHandler } from '../../src/modules/recruitment/application/queries/list-vacancies.handler';
import { ListVacanciesQuery } from '../../src/modules/recruitment/application/queries/list-vacancies.query';
import { NotFoundException } from '@nestjs/common';
import { getTestDatabase, TestDatabase } from '../helpers/test-database';

/**
 * Prueba de aislamiento multiempresa para el modulo de Reclutamiento.
 * SECURITY_RISK: una vacante de Empresa A no debe ser visible desde el contexto de Empresa B.
 * Cubre el requisito de aislamiento de datos por operatingCompanyId + branchId.
 * BDD ref: BR-REC-002 (procesos RRHH aplican a las 4 empresas del grupo pero datos aislados).
 */
describe('Recruitment — aislamiento multiempresa (Postgres real)', () => {
  let db: TestDatabase;
  let prisma: PrismaClient;

  const org = randomUUID();
  let roleIds: Map<string, string>;
  const companyA = randomUUID();
  const branchA = randomUUID();
  const companyB = randomUUID();
  const branchB = randomUUID();

  const UID_A = 'uid-rec-tenant-a';
  const UID_B = 'uid-rec-tenant-b';

  function buildPrismaService(): PrismaService {
    return prisma as unknown as PrismaService;
  }

  function buildWorkContext(companyId: string, branchId: string) {
    return {
      authorize: async () => ({
        organizationId: org,
        companyId,
        branchId,
        roleId: roleIds.get('HR_MANAGER')!,
        roleName: 'HR_MANAGER',
        roleKey: 'HR_MANAGER' as const,
      }),
    } as unknown as WorkContextAuthorizationService;
  }

  function buildMatrixAuth() {
    // Mockeado: esta suite prueba aislamiento de datos, no enforcement de permisos.
    // MatrixAuthorizationService con DB real requeriría sembrar la matriz completa.
    return {
      assertAllowed: async () => undefined,
    } as unknown as MatrixAuthorizationService;
  }

  function buildAudit() {
    return {
      recordRecruitmentEvent: async () => undefined,
    } as any;
  }

  function buildRecruitmentAccess(companyId: string, branchId: string): RecruitmentAccessService {
    return new RecruitmentAccessService(
      buildWorkContext(companyId, branchId),
      buildMatrixAuth(),
    );
  }

  beforeAll(async () => {
    db = await getTestDatabase();
    prisma = db.prisma;
    roleIds = await ensureSystemRoles(prisma, org);

    await prisma.company.createMany({
      data: [
        { id: companyA, organizationId: org, name: 'Empresa A Rec Isolation' },
        { id: companyB, organizationId: org, name: 'Empresa B Rec Isolation' },
      ],
    });
    await prisma.branch.createMany({
      data: [
        { id: branchA, companyId: companyA, name: 'Sede A Rec Isolation' },
        { id: branchB, companyId: companyB, name: 'Sede B Rec Isolation' },
      ],
    });

    // WorkContextAuthorizationService está mockeado — no se necesitan registros de userProfile en la DB.
  }, 60000);

  afterAll(async () => {
    if (db) await db.stop();
  });

  it('vacante de Empresa A NO aparece al listar desde el contexto de Empresa B', async () => {
    const ps = buildPrismaService();
    const vacancyRepo = new PrismaVacancyRepository(ps);
    const txManager = new PrismaTransactionManager(ps);
    const audit = buildAudit();

    // Crear vacante en Empresa A
    const accessA = buildRecruitmentAccess(companyA, branchA);
    const registerHandler = new RegisterVacancyHandler(accessA, vacancyRepo, txManager, audit);
    const vacancy = await registerHandler.execute(
      new RegisterVacancyCommand(UID_A, companyA, branchA, 'Asistente A', 'Operaciones', 'REFERIDO'),
    );
    expect(vacancy.operatingCompanyId).toBe(companyA);

    // Listar desde el contexto de Empresa B → no debe aparecer ninguna de A
    const accessB = buildRecruitmentAccess(companyB, branchB);
    const listHandler = new ListVacanciesHandler(accessB, vacancyRepo);
    const resultB = await listHandler.execute(
      new ListVacanciesQuery(UID_B, companyB, branchB),
    );

    const companyIds = resultB.map((v) => v.operatingCompanyId);
    expect(companyIds.every((cid) => cid === companyB)).toBe(true);
    expect(resultB.find((v) => v.id === vacancy.id)).toBeUndefined();
  }, 60000);

  it('listVacancies en Empresa B devuelve solo sus propias vacantes', async () => {
    const ps = buildPrismaService();
    const vacancyRepo = new PrismaVacancyRepository(ps);
    const txManager = new PrismaTransactionManager(ps);
    const audit = buildAudit();

    // Crear vacante en Empresa B
    const accessB = buildRecruitmentAccess(companyB, branchB);
    const registerHandler = new RegisterVacancyHandler(accessB, vacancyRepo, txManager, audit);
    const vacancyB = await registerHandler.execute(
      new RegisterVacancyCommand(UID_B, companyB, branchB, 'Conductor B', 'Flota', 'PORTAL_WEB'),
    );
    expect(vacancyB.operatingCompanyId).toBe(companyB);

    const listHandler = new ListVacanciesHandler(accessB, vacancyRepo);
    const resultB = await listHandler.execute(
      new ListVacanciesQuery(UID_B, companyB, branchB),
    );

    // Todas las vacantes retornadas pertenecen a Empresa B
    expect(resultB.length).toBeGreaterThanOrEqual(1);
    expect(resultB.every((v) => v.operatingCompanyId === companyB)).toBe(true);
  }, 60000);

  it('aislamiento de repositorio directo: listVacancies con filtro de empresa no mezcla datos', async () => {
    const ps = buildPrismaService();
    const vacancyRepo = new PrismaVacancyRepository(ps);

    // Consulta directa al repositorio filtrando por companyA — no debe devolver vacantes de companyB
    const resultA = await vacancyRepo.list(
      { operatingCompanyId: companyA, branchId: branchA, limit: 50 },
      { organizationId: org, operatingCompanyId: companyA },
    );
    expect(resultA.every((v) => v.operatingCompanyId === companyA)).toBe(true);

    // Consulta directa filtrando por companyB — no debe devolver vacantes de companyA
    const resultB = await vacancyRepo.list(
      { operatingCompanyId: companyB, branchId: branchB, limit: 50 },
      { organizationId: org, operatingCompanyId: companyB },
    );
    expect(resultB.every((v) => v.operatingCompanyId === companyB)).toBe(true);

    // Los conjuntos de IDs son disjuntos
    const idsA = new Set(resultA.map((v) => v.id));
    const idsB = new Set(resultB.map((v) => v.id));
    const intersection = [...idsA].filter((id) => idsB.has(id));
    expect(intersection).toHaveLength(0);
  }, 60000);
});
