import { randomUUID } from 'crypto';
import { ensureSystemRoles } from '../../src/modules/admin/infrastructure/persistence/system-roles-seeder';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../../src/common/persistence/prisma.service';
import { PrismaTransactionManager } from '../../src/common/persistence/prisma-transaction-manager';
import { PrismaEmployeeRepository } from '../../src/modules/hr-administration/infrastructure/persistence/prisma-employee.repository';
import { WorkContextAuthorizationService } from '../../src/modules/users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../src/modules/authorization/matrix-authorization.service';
import { HrAdministrationAccessService } from '../../src/modules/hr-administration/application/services/hr-administration-access.service';
import { CreateEmployeeHandler } from '../../src/modules/hr-administration/application/commands/create-employee.handler';
import { CreateEmployeeCommand } from '../../src/modules/hr-administration/application/commands/create-employee.command';
import { ListEmployeesHandler } from '../../src/modules/hr-administration/application/queries/list-employees.handler';
import { ListEmployeesQuery } from '../../src/modules/hr-administration/application/queries/list-employees.query';
import { getTestDatabase, TestDatabase } from '../helpers/test-database';

/**
 * Prueba de aislamiento multiempresa para el modulo HR-Administration.
 * SECURITY_RISK: un empleado de Empresa A no debe ser visible desde el contexto de Empresa B.
 * Cubre el requisito de aislamiento de datos por operatingCompanyId + branchId.
 * BDD ref: BR-ADP-001 (datos de asistencia/empleo son de la empresa donde trabaja el empleado).
 */
describe('HR-Administration — aislamiento multiempresa (Postgres real)', () => {
  let db: TestDatabase;
  let prisma: PrismaClient;

  const org = randomUUID();
  let roleIds: Map<string, string>;
  const companyA = randomUUID();
  const branchA = randomUUID();
  const companyB = randomUUID();
  const branchB = randomUUID();

  const UID_A = 'uid-adp-tenant-a';
  const UID_B = 'uid-adp-tenant-b';

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
      isAllowed: async () => true, // 22-oct: el listado consulta VIEW_EMPLOYEE_DOCUMENT via isActionAllowed
    } as unknown as MatrixAuthorizationService;
  }

  function buildAudit() {
    return {
      recordHrAdministrationEvent: async () => undefined,
    } as any;
  }

  function buildHrAccess(companyId: string, branchId: string): HrAdministrationAccessService {
    return new HrAdministrationAccessService(
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
        { id: companyA, organizationId: org, name: 'Empresa A ADP Isolation' },
        { id: companyB, organizationId: org, name: 'Empresa B ADP Isolation' },
      ],
    });
    await prisma.branch.createMany({
      data: [
        { id: branchA, companyId: companyA, name: 'Sede A ADP Isolation' },
        { id: branchB, companyId: companyB, name: 'Sede B ADP Isolation' },
      ],
    });

    // WorkContextAuthorizationService está mockeado — no se necesitan registros de userProfile en la DB.
  }, 60000);

  afterAll(async () => {
    if (db) await db.stop();
  });

  it('empleado de Empresa A NO aparece al listar desde el contexto de Empresa B', async () => {
    const ps = buildPrismaService();
    const employeeRepo = new PrismaEmployeeRepository(ps);
    const txManager = new PrismaTransactionManager(ps);
    const audit = buildAudit();

    // Crear empleado en Empresa A
    const accessA = buildHrAccess(companyA, branchA);
    const createHandler = new CreateEmployeeHandler(accessA, employeeRepo, txManager, audit);
    const employeeA = await createHandler.execute(
      new CreateEmployeeCommand(
        UID_A, companyA, branchA,
        'DNI', '12345678',
        'Colaborador Empresa A',
        'area-ops', 'Operaciones', 'Conductor',
        new Date('2026-01-15'),
      ),
    );
    expect(employeeA.operatingCompanyId).toBe(companyA);

    // Listar desde el contexto de Empresa B → no debe aparecer ninguno de A
    const accessB = buildHrAccess(companyB, branchB);
    const listHandler = new ListEmployeesHandler(accessB, employeeRepo);
    const { items: resultB } = await listHandler.execute(
      new ListEmployeesQuery(UID_B, companyB, branchB),
    );

    const companyIds = resultB.map((e) => e.operatingCompanyId);
    expect(companyIds.every((cid) => cid === companyB)).toBe(true);
    expect(resultB.find((e) => e.id === employeeA.id)).toBeUndefined();
  }, 60000);

  it('listEmployees en Empresa B devuelve solo sus propios empleados', async () => {
    const ps = buildPrismaService();
    const employeeRepo = new PrismaEmployeeRepository(ps);
    const txManager = new PrismaTransactionManager(ps);
    const audit = buildAudit();

    // Crear empleado en Empresa B
    const accessB = buildHrAccess(companyB, branchB);
    const createHandler = new CreateEmployeeHandler(accessB, employeeRepo, txManager, audit);
    const employeeB = await createHandler.execute(
      new CreateEmployeeCommand(
        UID_B, companyB, branchB,
        'DNI', '87654321',
        'Colaborador Empresa B',
        'area-admin', 'Administración', 'Asistente',
        new Date('2026-02-01'),
      ),
    );
    expect(employeeB.operatingCompanyId).toBe(companyB);

    const listHandler = new ListEmployeesHandler(accessB, employeeRepo);
    const { items: resultB } = await listHandler.execute(
      new ListEmployeesQuery(UID_B, companyB, branchB),
    );

    expect(resultB.length).toBeGreaterThanOrEqual(1);
    expect(resultB.every((e) => e.operatingCompanyId === companyB)).toBe(true);
  }, 60000);

  it('aislamiento de repositorio directo: findMany con filtro de empresa no mezcla datos', async () => {
    const ps = buildPrismaService();
    const employeeRepo = new PrismaEmployeeRepository(ps);

    const { items: resultA } = await employeeRepo.findMany({
      organizationId: org, companyId: companyA, branchId: branchA, limit: 50, offset: 0,
    });
    expect(resultA.every((e) => e.operatingCompanyId === companyA)).toBe(true);

    const { items: resultB } = await employeeRepo.findMany({
      organizationId: org, companyId: companyB, branchId: branchB, limit: 50, offset: 0,
    });
    expect(resultB.every((e) => e.operatingCompanyId === companyB)).toBe(true);

    // Los conjuntos de IDs son disjuntos
    const idsA = new Set(resultA.map((e) => e.id));
    const idsB = new Set(resultB.map((e) => e.id));
    const intersection = [...idsA].filter((id) => idsB.has(id));
    expect(intersection).toHaveLength(0);
  }, 60000);
});
