import { randomUUID } from 'crypto';
import { ensureSystemRoles } from '../../src/modules/admin/infrastructure/persistence/system-roles-seeder';
import { ForbiddenException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../../src/common/persistence/prisma.service';
import { PrismaTransactionManager } from '../../src/common/persistence/prisma-transaction-manager';
import { ClockPort } from '../../src/common/application/ports/clock.port';
import { PrismaOutboxEventRepository } from '../../src/modules/outbox/infrastructure/persistence/prisma-outbox-event.repository';
import { PrismaAuditEventRepository } from '../../src/modules/audit/infrastructure/persistence/prisma-audit-event.repository';
import { WorkContextAuthorizationService } from '../../src/modules/users/application/services/work-context-authorization.service';
import type { WorkerRole } from '../../src/modules/users/domain/worker-role';
import { MatrixAuthorizationService } from '../../src/modules/authorization/matrix-authorization.service';
import { PrismaRolePermissionMatrixRepository } from '../../src/modules/admin/infrastructure/persistence/prisma-role-permission-matrix.repository';
import { PrismaIncidentRepository } from '../../src/modules/incidents/infrastructure/persistence/prisma-incident.repository';
import { PrismaIncidentLinksAdapter } from '../../src/modules/incidents/infrastructure/persistence/prisma-incident-links.adapter';
import { PrismaReturnOpenIncidentsPersistence } from '../../src/modules/returns/infrastructure/persistence/prisma-return-open-incidents.persistence';
import { IncidentAccessService } from '../../src/modules/incidents/application/services/incident-access.service';
import { IncidentTransitionService } from '../../src/modules/incidents/application/services/incident-transition.service';
import { CreateIncidentHandler } from '../../src/modules/incidents/application/commands/create-incident.handler';
import { CreateIncidentCommand } from '../../src/modules/incidents/application/commands/create-incident.command';
import { AddIncidentActionHandler } from '../../src/modules/incidents/application/commands/add-incident-action.handler';
import { AddIncidentActionCommand } from '../../src/modules/incidents/application/commands/add-incident-action.command';
import { ResolveIncidentHandler } from '../../src/modules/incidents/application/commands/resolve-incident.handler';
import { ResolveIncidentCommand } from '../../src/modules/incidents/application/commands/resolve-incident.command';
import { CloseIncidentHandler } from '../../src/modules/incidents/application/commands/close-incident.handler';
import { CloseIncidentCommand } from '../../src/modules/incidents/application/commands/close-incident.command';
import { ReferIncidentToLegalHandler } from '../../src/modules/incidents/application/commands/refer-incident-to-legal.handler';
import { ReferIncidentToLegalCommand } from '../../src/modules/incidents/application/commands/refer-incident-to-legal.command';
import { GetIncidentHandler } from '../../src/modules/incidents/application/queries/get-incident.handler';
import { GetIncidentQuery } from '../../src/modules/incidents/application/queries/get-incident.query';
import { ListIncidentsHandler } from '../../src/modules/incidents/application/queries/list-incidents.handler';
import { ListIncidentsQuery } from '../../src/modules/incidents/application/queries/list-incidents.query';
import {
  IncidentDirectResolveNotAllowedError,
  IncidentNotFoundError,
  IncidentNotOpenError,
  IncidentRentalNotFoundError,
  IncidentReturnNotFoundError,
  IncidentVersionConflictError,
} from '../../src/modules/incidents/domain/incident-errors';
import { getTestDatabase, TestDatabase } from '../helpers/test-database';

/** Reloj controlable para ordenar de forma determinista la bandeja keyset. */
class StepClock extends ClockPort {
  constructor(private current: Date) {
    super();
  }
  set(value: Date): void {
    this.current = value;
  }
  now(): Date {
    return new Date(this.current);
  }
}

/**
 * Incidencias (INC-01/INC-02) sobre PostgreSQL real: ciclo registrar -> acciones -> resolver/cerrar/derivar,
 * optimistic concurrency, historial append-only, auditoria + outbox atomicos, aislamiento multiempresa, bloqueo de
 * Devolucion (DEV-09) y restricciones de la migracion (FK compuestas, CHECK de cierre).
 */
describe('Incidents - ciclo de vida completo y aislamiento multiempresa (Postgres real)', () => {
  let db: TestDatabase;
  let prisma: PrismaClient;

  const org = randomUUID();
  /** key de rol de sistema -> role_id sembrado para `org` (roles dinamicos). */
  let roleIds: Map<string, string>;
  const companyA = randomUUID();
  const branchA = randomUUID();
  const companyB = randomUUID();
  const branchB = randomUUID();
  const customerA = randomUUID();
  const customerB = randomUUID();
  const vehicleA = randomUUID();
  const vehicleB = randomUUID();
  const rentalA = randomUUID();
  const rentalA2 = randomUUID();
  const rentalB = randomUUID();
  const returnA = randomUUID();
  const returnA2 = randomUUID();

  const UID_A = 'uid-it-incident-a';
  const UID_B = 'uid-it-incident-b';
  const clock = new StepClock(new Date('2026-10-06T12:00:00.000Z'));
  /**
   * Avanza el reloj: dos entradas del historial con el mismo createdAt se desempatan por id (UUID aleatorio) y el orden
   * dejaria de ser el de insercion. En produccion cada accion es una peticion distinta; en el test hay que separarlas.
   */
  const tick = (seconds = 1): void => clock.set(new Date(clock.now().getTime() + seconds * 1000));

  function buildPrismaService(): PrismaService {
    return prisma as unknown as PrismaService;
  }

  function buildWorkContext(companyId: string, branchId: string, role: WorkerRole = 'FRONT_OFFICE') {
    return {
      authorize: async () => ({ organizationId: org, companyId, branchId, roleId: roleIds.get(role)!, roleName: role, roleKey: role }),
    } as unknown as WorkContextAuthorizationService;
  }

  /** Cablea todos los handlers con dependencias reales (repositorios Prisma, auditoria y outbox reales). */
  function buildStack(companyId: string, branchId: string, role: WorkerRole = 'FRONT_OFFICE') {
    const ps = buildPrismaService();
    const incidents = new PrismaIncidentRepository(ps);
    const links = new PrismaIncidentLinksAdapter(ps);
    const txManager = new PrismaTransactionManager(ps);
    const audit = new PrismaAuditEventRepository(ps);
    const outbox = new PrismaOutboxEventRepository(ps);
    const matrixAuth = new MatrixAuthorizationService(new PrismaRolePermissionMatrixRepository(ps));
    const access = new IncidentAccessService(buildWorkContext(companyId, branchId, role), matrixAuth);
    const transitions = new IncidentTransitionService(incidents, txManager, clock, audit, outbox);
    return {
      create: new CreateIncidentHandler(access, incidents, links, txManager, clock, audit, outbox),
      addAction: new AddIncidentActionHandler(access, transitions),
      resolve: new ResolveIncidentHandler(access, transitions),
      close: new CloseIncidentHandler(access, transitions),
      refer: new ReferIncidentToLegalHandler(access, transitions),
      get: new GetIncidentHandler(access, incidents),
      list: new ListIncidentsHandler(access, incidents),
    };
  }

  const stackA = () => buildStack(companyA, branchA);
  const stackB = () => buildStack(companyB, branchB);

  const createCmd = (overrides: Partial<{ rentalId: string; returnId: string; severity: 'LEVE' | 'MODERADA' | 'GRAVE'; description: string }> = {}) =>
    new CreateIncidentCommand(
      UID_A,
      companyA,
      branchA,
      overrides.rentalId ?? rentalA,
      'KEY_LOSS',
      overrides.severity ?? 'LEVE',
      overrides.description ?? 'Cliente reporta pérdida de llave',
      overrides.returnId,
    );

  beforeAll(async () => {
    db = await getTestDatabase();
    prisma = db.prisma;
    roleIds = await ensureSystemRoles(prisma, org);

    await prisma.company.createMany({
      data: [
        { id: companyA, organizationId: org, name: 'Empresa A Incidencias' },
        { id: companyB, organizationId: org, name: 'Empresa B Incidencias' },
      ],
    });
    await prisma.branch.createMany({
      data: [
        { id: branchA, companyId: companyA, name: 'Sede A Incidencias' },
        { id: branchB, companyId: companyB, name: 'Sede B Incidencias' },
      ],
    });
    await prisma.customer.createMany({
      data: [
        { id: customerA, organizationId: org, operatingCompanyId: companyA, fullName: 'Cliente A', documentType: 'DNI', documentNumber: `A${randomUUID().slice(0, 7)}` },
        { id: customerB, organizationId: org, operatingCompanyId: companyB, fullName: 'Cliente B', documentType: 'DNI', documentNumber: `B${randomUUID().slice(0, 7)}` },
      ],
    });
    await prisma.vehicle.createMany({
      data: [
        { id: vehicleA, organizationId: org, operatingCompanyId: companyA, plate: `IA-${vehicleA.slice(0, 6)}`, brand: 'Toyota', model: 'Yaris' },
        { id: vehicleB, organizationId: org, operatingCompanyId: companyB, plate: `IB-${vehicleB.slice(0, 6)}`, brand: 'Honda', model: 'Fit' },
      ],
    });
    const rentalBase = { organizationId: org, createdBy: UID_A, updatedBy: UID_A, status: 'ACTIVE' as const };
    await prisma.rental.createMany({
      data: [
        { id: rentalA, ...rentalBase, operatingCompanyId: companyA, branchId: branchA, customerId: customerA, vehicleId: vehicleA },
        { id: rentalA2, ...rentalBase, operatingCompanyId: companyA, branchId: branchA, customerId: customerA, vehicleId: vehicleA },
        { id: rentalB, ...rentalBase, operatingCompanyId: companyB, branchId: branchB, customerId: customerB, vehicleId: vehicleB, createdBy: UID_B, updatedBy: UID_B },
      ],
    });
    const returnBase = { organizationId: org, operatingCompanyId: companyA, branchId: branchA, customerId: customerA, vehicleId: vehicleA, scheduledAt: new Date('2026-10-07T10:00:00.000Z'), createdBy: UID_A, updatedBy: UID_A };
    await prisma.rentalReturn.createMany({
      data: [
        { id: returnA, rentalId: rentalA, ...returnBase },
        { id: returnA2, rentalId: rentalA2, ...returnBase },
      ],
    });
  }, 90000);

  afterAll(async () => {
    if (db) await db.stop();
  });

  it('LEVE: registrar -> agregar accion -> resolver directo; historial append-only, version y eventos atomicos', async () => {
    const stack = stackA();
    const created = await stack.create.execute(createCmd());

    expect(created).toMatchObject({ status: 'ABIERTA', version: 1, rentalId: rentalA, responsibleUserId: UID_A, severity: 'LEVE' });
    expect(created.actions.map((a) => a.kind)).toEqual(['REPORTED']);

    clock.set(new Date('2026-10-06T12:05:00.000Z'));
    const withAction = await stack.addAction.execute(new AddIncidentActionCommand(created.id, UID_A, companyA, branchA, 1, 'Se contactó al cliente'));
    expect(withAction).toMatchObject({ status: 'ABIERTA', version: 2 });
    expect(withAction.actions.map((a) => a.kind)).toEqual(['REPORTED', 'ACTION']);

    clock.set(new Date('2026-10-06T12:10:00.000Z'));
    const resolved = await stack.resolve.execute(new ResolveIncidentCommand(created.id, UID_A, companyA, branchA, 2, 'Llave recuperada'));
    expect(resolved).toMatchObject({ status: 'CERRADA', version: 3, resolutionSummary: 'Llave recuperada' });
    expect(resolved.resolvedAt).toEqual(new Date('2026-10-06T12:10:00.000Z'));
    expect(resolved.actions.map((a) => a.kind)).toEqual(['REPORTED', 'ACTION', 'RESOLVED']);
    // El historial previo queda intacto (append-only).
    expect(resolved.actions.slice(0, 2)).toEqual(withAction.actions);

    const audit = await prisma.auditEvent.findMany({ where: { entityType: 'incident', entityId: created.id }, orderBy: { createdAt: 'asc' } });
    expect(audit.map((e) => e.action).sort()).toEqual(['INCIDENT_ACTION_ADDED', 'INCIDENT_REGISTERED', 'INCIDENT_RESOLVED']);
    expect(audit.every((e) => e.organizationId === org && e.actorUserId === UID_A)).toBe(true);

    const outbox = await prisma.outboxEvent.findMany({ where: { aggregateType: 'incident', aggregateId: created.id } });
    expect(outbox.map((e) => e.eventType).sort()).toEqual(['IncidentActionAdded.v1', 'IncidentRegistered.v1', 'IncidentResolved.v1']);
  });

  it.each(['MODERADA', 'GRAVE'] as const)('%s: resolver directo -> 422; cerrar desde el detalle con resumen -> CERRADA', async (severity) => {
    const stack = stackA();
    const created = await stack.create.execute(createCmd({ severity }));
    tick();

    await expect(stack.resolve.execute(new ResolveIncidentCommand(created.id, UID_A, companyA, branchA, 1, 'x'))).rejects.toThrow(IncidentDirectResolveNotAllowedError);
    const untouched = await stack.get.execute(new GetIncidentQuery(created.id, UID_A, companyA, branchA));
    expect(untouched).toMatchObject({ status: 'ABIERTA', version: 1 });
    expect(untouched.actions).toHaveLength(1);

    const closed = await stack.close.execute(new CloseIncidentCommand(created.id, UID_A, companyA, branchA, 1, 'Revisado con Gerencia'));
    expect(closed).toMatchObject({ status: 'CERRADA', version: 2, resolutionSummary: 'Revisado con Gerencia' });
    expect(closed.actions.map((a) => a.kind)).toEqual(['REPORTED', 'CLOSED']);
  });

  it('If-Match desactualizado -> VERSION_CONFLICT y nada se escribe (ni entrada, ni auditoria, ni outbox)', async () => {
    const stack = stackA();
    const created = await stack.create.execute(createCmd());
    tick();
    await stack.addAction.execute(new AddIncidentActionCommand(created.id, UID_A, companyA, branchA, 1, 'Primera accion'));

    await expect(stack.addAction.execute(new AddIncidentActionCommand(created.id, UID_A, companyA, branchA, 1, 'Accion con version vieja'))).rejects.toThrow(
      IncidentVersionConflictError,
    );

    const after = await stack.get.execute(new GetIncidentQuery(created.id, UID_A, companyA, branchA));
    expect(after.version).toBe(2);
    expect(after.actions.map((a) => a.description)).toEqual([created.description, 'Primera accion']);
    expect(await prisma.auditEvent.count({ where: { entityType: 'incident', entityId: created.id } })).toBe(2);
    expect(await prisma.outboxEvent.count({ where: { aggregateType: 'incident', aggregateId: created.id } })).toBe(2);
  });

  it('derivar a via legal -> VIA_LEGAL terminal: ya no admite acciones, cierre ni nueva derivacion (INCIDENT_NOT_OPEN)', async () => {
    const stack = stackA();
    const created = await stack.create.execute(createCmd({ severity: 'GRAVE' }));
    tick();

    const referred = await stack.refer.execute(new ReferIncidentToLegalCommand(created.id, UID_A, companyA, branchA, 1, 'Cliente no responde'));
    expect(referred).toMatchObject({ status: 'VIA_LEGAL', version: 2, resolutionSummary: null, resolvedAt: null });
    expect(referred.actions.at(-1)).toMatchObject({ kind: 'REFERRED_LEGAL', description: 'Cliente no responde' });

    await expect(stack.addAction.execute(new AddIncidentActionCommand(created.id, UID_A, companyA, branchA, 2, 'otra'))).rejects.toThrow(IncidentNotOpenError);
    await expect(stack.close.execute(new CloseIncidentCommand(created.id, UID_A, companyA, branchA, 2, 'cerrar'))).rejects.toThrow(IncidentNotOpenError);
    await expect(stack.refer.execute(new ReferIncidentToLegalCommand(created.id, UID_A, companyA, branchA, 2, 'otra vez'))).rejects.toThrow(IncidentNotOpenError);
  });

  it('roles de solo lectura (FINANZAS/AUDITORIA) ven pero no escriben; rol sin acceso no ve', async () => {
    const created = await stackA().create.execute(createCmd());
    const finanzas = buildStack(companyA, branchA, 'FINANZAS');
    await expect(finanzas.get.execute(new GetIncidentQuery(created.id, UID_A, companyA, branchA))).resolves.toMatchObject({ id: created.id });
    await expect(finanzas.close.execute(new CloseIncidentCommand(created.id, UID_A, companyA, branchA, 1, 'x'))).rejects.toThrow(ForbiddenException);
    await expect(buildStack(companyA, branchA, 'ADMINISTRACION').list.execute(new ListIncidentsQuery(UID_A, companyA, branchA))).rejects.toThrow(ForbiddenException);
  });

  it('aislamiento multiempresa: la Empresa B no ve, lista, modifica ni liga incidencias de la Empresa A', async () => {
    const created = await stackA().create.execute(createCmd({ description: 'Incidencia exclusiva de A' }));

    await expect(stackB().get.execute(new GetIncidentQuery(created.id, UID_B, companyB, branchB))).rejects.toThrow(IncidentNotFoundError);
    const listB = await stackB().list.execute(new ListIncidentsQuery(UID_B, companyB, branchB));
    expect(listB.find((i) => i.id === created.id)).toBeUndefined();
    expect(listB.every((i) => i.operatingCompanyId === companyB)).toBe(true);

    await expect(stackB().addAction.execute(new AddIncidentActionCommand(created.id, UID_B, companyB, branchB, 1, 'intruso'))).rejects.toThrow(IncidentNotFoundError);
    await expect(stackB().close.execute(new CloseIncidentCommand(created.id, UID_B, companyB, branchB, 1, 'intruso'))).rejects.toThrow(IncidentNotFoundError);
    // B no puede registrar contra el alquiler de A.
    await expect(stackB().create.execute(new CreateIncidentCommand(UID_B, companyB, branchB, rentalA, 'OTHER', 'LEVE', 'cruzada'))).rejects.toThrow(IncidentRentalNotFoundError);

    const stillOpen = await stackA().get.execute(new GetIncidentQuery(created.id, UID_A, companyA, branchA));
    expect(stillOpen).toMatchObject({ status: 'ABIERTA', version: 1 });
    expect(stillOpen.actions).toHaveLength(1);

    const listA = await stackA().list.execute(new ListIncidentsQuery(UID_A, companyA, branchA));
    expect(listA.some((i) => i.id === created.id)).toBe(true);
    expect(listA.every((i) => i.operatingCompanyId === companyA)).toBe(true);
  });

  it('vinculos: devolucion inexistente, de otro alquiler o de otra empresa -> RETURN_NOT_FOUND; la valida del mismo alquiler se guarda', async () => {
    const stack = stackA();
    await expect(stack.create.execute(createCmd({ returnId: randomUUID() }))).rejects.toThrow(IncidentReturnNotFoundError);
    await expect(stack.create.execute(createCmd({ rentalId: rentalA, returnId: returnA2 }))).rejects.toThrow(IncidentReturnNotFoundError);

    const linked = await stack.create.execute(createCmd({ rentalId: rentalA, returnId: returnA }));
    expect(linked.returnId).toBe(returnA);
    const byReturn = await stack.list.execute(new ListIncidentsQuery(UID_A, companyA, branchA, undefined, undefined, undefined, undefined, returnA));
    expect(byReturn.map((i) => i.id)).toContain(linked.id);
    expect(byReturn.every((i) => i.returnId === returnA)).toBe(true);
  });

  it('DEV-09: solo las incidencias ABIERTAS del alquiler/devolucion bloquean (ReturnOpenIncidentsPort)', async () => {
    const persistence = new PrismaReturnOpenIncidentsPersistence(buildPrismaService());
    const scope = { organizationId: org, operatingCompanyId: companyA, branchId: branchA };
    const stack = stackA();
    const input = { rentalId: rentalA2, returnId: returnA2, scope };

    expect(await persistence.findOpenIncidentIds(input)).toEqual([]);

    const byRental = await stack.create.execute(createCmd({ rentalId: rentalA2 }));
    const byReturn = await stack.create.execute(createCmd({ rentalId: rentalA2, returnId: returnA2, severity: 'GRAVE' }));
    expect((await persistence.findOpenIncidentIds(input)).sort()).toEqual([byRental.id, byReturn.id].sort());

    await stack.close.execute(new CloseIncidentCommand(byRental.id, UID_A, companyA, branchA, 1, 'cerrada'));
    expect(await persistence.findOpenIncidentIds(input)).toEqual([byReturn.id]);

    await stack.refer.execute(new ReferIncidentToLegalCommand(byReturn.id, UID_A, companyA, branchA, 1, 'via legal'));
    expect(await persistence.findOpenIncidentIds(input)).toEqual([]);

    // Otra empresa nunca ve incidencias ajenas.
    expect(await persistence.findOpenIncidentIds({ rentalId: rentalA2, returnId: returnA2, scope: { organizationId: org, operatingCompanyId: companyB, branchId: branchB } })).toEqual([]);
  });

  it('bandeja keyset: paginas estables (createdAt DESC, id DESC) sin repetir ni saltar filas, y filtros', async () => {
    const stack = stackA();
    const ids: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      clock.set(new Date(`2026-10-07T09:0${i}:00.000Z`));
      const created = await stack.create.execute(createCmd({ rentalId: rentalA2, severity: 'MODERADA', description: `Paginacion ${i}` }));
      ids.push(created.id);
    }
    const base = (limit: number, cursor?: { createdAt: Date; id: string }) =>
      stack.list.execute(new ListIncidentsQuery(UID_A, companyA, branchA, undefined, 'MODERADA', 'ABIERTA', rentalA2, undefined, limit, cursor));

    const page1 = await base(2);
    expect(page1.map((i) => i.id)).toEqual([ids[2], ids[1]]);
    const last = page1[page1.length - 1];
    const page2 = await base(2, { createdAt: last.createdAt, id: last.id });
    expect(page2.map((i) => i.id)).toEqual([ids[0]]);
  });

  it('restricciones de la migracion: FK compuesta por empresa y CHECK de cierre con resumen', async () => {
    const base = { organizationId: org, branchId: branchB, type: 'OTHER' as const, severity: 'LEVE' as const, description: 'x', reportedAt: new Date(), responsibleUserId: UID_B, createdBy: UID_B, updatedBy: UID_B };
    // rentalA pertenece a la empresa A: la FK (rental_id, operating_company_id) impide ligarla desde la empresa B.
    await expect(prisma.incident.create({ data: { ...base, operatingCompanyId: companyB, rentalId: rentalA } })).rejects.toThrow();

    const created = await stackA().create.execute(createCmd());
    await expect(prisma.incident.update({ where: { id: created.id }, data: { status: 'CERRADA' } })).rejects.toThrow();
    await expect(prisma.incident.update({ where: { id: created.id }, data: { description: '   ' } })).rejects.toThrow();
  });
});
