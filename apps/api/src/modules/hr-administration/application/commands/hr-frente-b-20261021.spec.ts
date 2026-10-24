import { ForbiddenException } from '@nestjs/common';
import type { VacationRequest } from '@prisma/client';
import {
  EmployeeSalaryGerenciaOnlyError,
  HrAreaAlreadyExistsError,
  HrAreaInUseError,
  HrAreaNotFoundError,
  InvalidAttendanceRecordError,
  VacationOverlapError,
} from '../../domain/hr-administration-errors';
import { DEFAULT_HR_AREAS, areaAliasCode, areaFilterCode } from '../../domain/hr-area-rules';
import { PrismaVacationRepository } from '../../infrastructure/persistence/prisma-vacation.repository';
import { ensureHrAreasForCompany } from '../../infrastructure/persistence/hr-areas-seeder';
import {
  BRANCH_ID,
  COMPANY_ID,
  FixedClock,
  ORG_ID,
  buildAudit,
  buildEmployee,
  buildMatrixAuth,
  buildTransactionManager,
  buildWorkContext,
} from '../../testing/hr-administration-test-fixtures';
import { HrAdministrationAccessService } from '../services/hr-administration-access.service';
import { HrAreaResolverService } from '../services/hr-area-resolver.service';
import type { EmployeeRepositoryPort } from '../ports/employee-repository.port';
import type { AttendanceRepositoryPort } from '../ports/attendance-repository.port';
import type { VacationRepositoryPort, CreateVacationData } from '../ports/vacation-repository.port';
import type { HrAreaAdminView, HrAreaRepositoryPort } from '../ports/hr-area-repository.port';
import type { HrMemoService } from '../services/hr-memo.service';
import { ListHrAreasHandler } from '../queries/list-hr-areas.handler';
import { ListHrAreasQuery } from '../queries/list-hr-areas.query';
import { CreateHrAreaCommand } from './create-hr-area.command';
import { CreateHrAreaHandler } from './create-hr-area.handler';
import { SetHrAreaActiveCommand } from './set-hr-area-active.command';
import { SetHrAreaActiveHandler } from './set-hr-area-active.handler';
import { UpdateEmployeeCommand } from './update-employee.command';
import { UpdateEmployeeHandler } from './update-employee.handler';
import { ScheduleVacationCommand } from './schedule-vacation.command';
import { ScheduleVacationHandler } from './schedule-vacation.handler';
import { LogAttendanceCommand } from './log-attendance.command';
import { LogAttendanceHandler, resolveAttendanceLocation } from './log-attendance.handler';

const UID = 'uid-1';
const ACCESS = (role: Parameters<typeof buildWorkContext>[0]) => new HrAdministrationAccessService(buildWorkContext(role), buildMatrixAuth());

function area(code: string, name: string, over: Partial<HrAreaAdminView> = {}): HrAreaAdminView {
  return { code, name, description: null, sortOrder: 10, isActive: true, ...over };
}

function areasRepo(items: HrAreaAdminView[]) {
  return {
    listActive: jest.fn().mockImplementation(async () => items.filter((a) => a.isActive)),
    listAll: jest.fn().mockResolvedValue(items),
    findByCode: jest.fn().mockImplementation(async (_c: string, code: string) => items.find((a) => a.code === code) ?? null),
    create: jest.fn().mockImplementation(async (d: { code: string; name: string; description?: string | null; sortOrder: number }) =>
      area(d.code, d.name, { description: d.description ?? null, sortOrder: d.sortOrder })),
    setActive: jest.fn().mockImplementation(async (_c: string, code: string, isActive: boolean) =>
      ({ ...(items.find((a) => a.code === code) as HrAreaAdminView), isActive })),
    countActiveEmployees: jest.fn().mockResolvedValue(0),
    maxSortOrder: jest.fn().mockResolvedValue(90),
  } as unknown as jest.Mocked<HrAreaRepositoryPort>;
}

describe('Catalogo de areas: reglas de dominio (Respuestas 2026-10-20 #17)', () => {
  it('el catalogo por defecto trae las 7 del organigrama + Gerencia General/Subgerencia + Gestion y Procesos, sin Contabilidad', () => {
    expect(DEFAULT_HR_AREAS.map((a) => a.code)).toEqual([
      'ADMINISTRACION', 'TALENTO_HUMANO', 'SERVICIOS_GENERALES', 'DESARROLLO_DE_TECNOLOGIA', 'ATENCION_AL_CLIENTE',
      'MARKETING', 'OPERACIONES', 'GERENCIA_GENERAL', 'GESTION_Y_PROCESOS',
    ]);
    expect(DEFAULT_HR_AREAS.some((a) => /contabilidad/i.test(a.name))).toBe(false);
    expect(new Set(DEFAULT_HR_AREAS.map((a) => a.sortOrder)).size).toBe(DEFAULT_HR_AREAS.length);
  });

  it.each(['RRHH', 'rr.hh.', 'Recursos Humanos', 'RECURSOS  HUMANOS', 'Gestión de Talento Humano'])('«%s» es alias de TALENTO_HUMANO', (text) => {
    expect(areaAliasCode(text)).toBe('TALENTO_HUMANO');
    expect(areaFilterCode(text)).toBe('TALENTO_HUMANO');
  });

  it('un texto sin alias se filtra por su codigo normalizado', () => {
    expect(areaFilterCode('Atención al cliente')).toBe('ATENCION_AL_CLIENTE');
  });
});

describe('HrAreaResolverService con alias RRHH', () => {
  const catalog = DEFAULT_HR_AREAS.map((a) => area(a.code, a.name));
  const resolver = new HrAreaResolverService(areasRepo(catalog));

  it.each(['RRHH', 'Recursos Humanos', 'rr.hh'])('texto libre «%s» se guarda como Talento Humano del catalogo', async (name) => {
    await expect(resolver.resolve({ operatingCompanyId: COMPANY_ID, areaName: name })).resolves.toEqual({
      areaId: 'TALENTO_HUMANO', areaName: 'Talento Humano', source: 'CATALOG',
    });
  });

  it('areaCode=RRHH tambien resuelve a Talento Humano', async () => {
    await expect(resolver.resolve({ operatingCompanyId: COMPANY_ID, areaCode: 'RRHH' })).resolves.toMatchObject({ areaId: 'TALENTO_HUMANO' });
  });

  it('si la empresa no tiene Talento Humano activo, «RRHH» queda como texto libre (no inventa el area)', async () => {
    const r = new HrAreaResolverService(areasRepo([area('MARKETING', 'Marketing')]));
    await expect(r.resolve({ operatingCompanyId: COMPANY_ID, areaName: 'RRHH' })).resolves.toMatchObject({ areaId: 'RRHH', source: 'FREE_TEXT' });
  });
});

describe('CreateHrAreaHandler (alta de areas solo Gerencia)', () => {
  const existing = DEFAULT_HR_AREAS.map((a) => area(a.code, a.name));
  const build = (role: Parameters<typeof buildWorkContext>[0], items = existing) => {
    const areas = areasRepo(items);
    const audit = buildAudit();
    const tm = buildTransactionManager();
    return { areas, audit, tm, handler: new CreateHrAreaHandler(ACCESS(role), areas, tm, audit) };
  };

  it('Gerencia crea un area nueva: codigo derivado, al final del orden, con auditoria', async () => {
    const s = build('GERENCIA');
    const created = await s.handler.execute(new CreateHrAreaCommand(UID, COMPANY_ID, BRANCH_ID, '  Logística   y Almacén ', ' Apoyo '));
    expect(created.code).toBe('LOGISTICA_Y_ALMACEN');
    expect(s.areas.create).toHaveBeenCalledWith(
      { organizationId: ORG_ID, operatingCompanyId: COMPANY_ID, code: 'LOGISTICA_Y_ALMACEN', name: 'Logística y Almacén', description: 'Apoyo', sortOrder: 100 },
      s.tm.tx,
    );
    expect(s.audit.recordHrAdministrationEvent).toHaveBeenCalledWith(
      expect.objectContaining({ entityType: 'hr_area', action: 'HR_AREA_CREATED', actorUserId: UID }),
      s.tm.tx,
    );
  });

  it.each(['RRHH', 'RECURSOS HUMANOS', 'operaciones', 'Atención al Cliente'])('409 HR_AREA_ALREADY_EXISTS si «%s» ya existe o es alias', async (name) => {
    const s = build('GERENCIA');
    const err = await s.handler.execute(new CreateHrAreaCommand(UID, COMPANY_ID, BRANCH_ID, name)).catch((e) => e);
    expect(err).toBeInstanceOf(HrAreaAlreadyExistsError);
    expect(err.httpStatus).toBe(409);
    expect(err.code).toBe('HR_AREA_ALREADY_EXISTS');
    expect(s.areas.create).not.toHaveBeenCalled();
  });

  it('un area inactiva con el mismo codigo tambien bloquea el alta (se reactiva, no se duplica)', async () => {
    const s = build('GERENCIA', [area('MARKETING', 'Marketing', { isActive: false })]);
    await expect(s.handler.execute(new CreateHrAreaCommand(UID, COMPANY_ID, BRANCH_ID, 'Marketing'))).rejects.toBeInstanceOf(HrAreaAlreadyExistsError);
  });

  it.each(['RRHH', 'ADMINISTRACION', 'AUDITORIA', 'FINANZAS', 'CAMPO'] as const)('%s NO puede dar de alta areas (403)', async (role) => {
    const s = build(role);
    await expect(s.handler.execute(new CreateHrAreaCommand(UID, COMPANY_ID, BRANCH_ID, 'Nueva'))).rejects.toBeInstanceOf(ForbiddenException);
    expect(s.areas.create).not.toHaveBeenCalled();
  });

  it('un nombre sin letras ni numeros se rechaza (422)', async () => {
    const s = build('GERENCIA');
    await expect(s.handler.execute(new CreateHrAreaCommand(UID, COMPANY_ID, BRANCH_ID, '---'))).rejects.toMatchObject({ code: 'HR_AREA_NAME_INVALID' });
  });
});

describe('SetHrAreaActiveHandler', () => {
  const items = [area('MARKETING', 'Marketing'), area('VENTAS', 'Ventas', { isActive: false })];
  const build = (role: Parameters<typeof buildWorkContext>[0]) => {
    const areas = areasRepo(items);
    const audit = buildAudit();
    const tm = buildTransactionManager();
    return { areas, audit, tm, handler: new SetHrAreaActiveHandler(ACCESS(role), areas, tm, audit) };
  };

  it('Gerencia desactiva un area sin colaboradores y lo audita', async () => {
    const s = build('GERENCIA');
    const r = await s.handler.execute(new SetHrAreaActiveCommand(UID, COMPANY_ID, BRANCH_ID, 'marketing', false));
    expect(r.isActive).toBe(false);
    expect(s.areas.setActive).toHaveBeenCalledWith(COMPANY_ID, 'MARKETING', false, s.tm.tx);
    expect(s.audit.recordHrAdministrationEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'HR_AREA_DEACTIVATED' }), s.tm.tx);
  });

  it('409 HR_AREA_IN_USE si hay colaboradores activos', async () => {
    const s = build('GERENCIA');
    s.areas.countActiveEmployees.mockResolvedValue(3);
    await expect(s.handler.execute(new SetHrAreaActiveCommand(UID, COMPANY_ID, BRANCH_ID, 'MARKETING', false))).rejects.toBeInstanceOf(HrAreaInUseError);
    expect(s.areas.setActive).not.toHaveBeenCalled();
  });

  it('reactivar un area inactiva funciona; repetir el estado actual no audita', async () => {
    const s = build('GERENCIA');
    await s.handler.execute(new SetHrAreaActiveCommand(UID, COMPANY_ID, BRANCH_ID, 'VENTAS', true));
    expect(s.audit.recordHrAdministrationEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'HR_AREA_ACTIVATED' }), s.tm.tx);
    s.audit.recordHrAdministrationEvent.mockClear();
    await s.handler.execute(new SetHrAreaActiveCommand(UID, COMPANY_ID, BRANCH_ID, 'MARKETING', true));
    expect(s.audit.recordHrAdministrationEvent).not.toHaveBeenCalled();
  });

  it('404/422 HR_AREA_NOT_FOUND si el area no existe en la empresa', async () => {
    const s = build('GERENCIA');
    await expect(s.handler.execute(new SetHrAreaActiveCommand(UID, COMPANY_ID, BRANCH_ID, 'NOPE', false))).rejects.toBeInstanceOf(HrAreaNotFoundError);
  });

  it('RRHH no puede desactivar areas', async () => {
    const s = build('RRHH');
    await expect(s.handler.execute(new SetHrAreaActiveCommand(UID, COMPANY_ID, BRANCH_ID, 'MARKETING', false))).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('ListHrAreasHandler includeInactive', () => {
  it('includeInactive exige MANAGE_AREAS (Gerencia); RRHH recibe 403', async () => {
    const areas = areasRepo([area('A', 'A'), area('B', 'B', { isActive: false })]);
    const g = await new ListHrAreasHandler(ACCESS('GERENCIA'), areas).execute(new ListHrAreasQuery(UID, COMPANY_ID, BRANCH_ID, true));
    expect(g).toHaveLength(2);
    await expect(new ListHrAreasHandler(ACCESS('RRHH'), areas).execute(new ListHrAreasQuery(UID, COMPANY_ID, BRANCH_ID, true))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('sin includeInactive solo devuelve activas (con isActive=true)', async () => {
    const areas = areasRepo([area('A', 'A'), area('B', 'B', { isActive: false })]);
    const r = await new ListHrAreasHandler(ACCESS('ADMINISTRACION'), areas).execute(new ListHrAreasQuery(UID, COMPANY_ID, BRANCH_ID));
    expect(r.map((a) => [a.code, a.isActive])).toEqual([['A', true]]);
  });
});

describe('ensureHrAreasForCompany (alta de empresa)', () => {
  it('siembra las 9 areas de la empresa nueva, idempotente (skipDuplicates)', async () => {
    const createMany = jest.fn().mockResolvedValue({ count: 9 });
    const n = await ensureHrAreasForCompany({ hrArea: { createMany } } as never, 'org-1', 'comp-2');
    expect(n).toBe(9);
    const arg = createMany.mock.calls[0][0];
    expect(arg.skipDuplicates).toBe(true);
    expect(arg.data).toHaveLength(9);
    expect(arg.data.every((d: { organizationId: string; operatingCompanyId: string }) => d.organizationId === 'org-1' && d.operatingCompanyId === 'comp-2')).toBe(true);
  });
});

describe('UpdateEmployeeHandler: sueldo base solo Gerencia y correo vacio (Respuestas #19)', () => {
  function build(role: Parameters<typeof buildWorkContext>[0], employee = buildEmployee()) {
    const employees = {
      findById: jest.fn().mockResolvedValue(employee),
      update: jest.fn().mockImplementation(async (_id: string, data: Record<string, unknown>) => ({ ...employee, ...data })),
    } as unknown as jest.Mocked<EmployeeRepositoryPort>;
    const tm = buildTransactionManager();
    const audit = buildAudit();
    return { employees, tm, audit, handler: new UpdateEmployeeHandler(ACCESS(role), employees, tm, audit) };
  }

  it('ADMINISTRACION (MANAGE_EMPLOYEES) edita el puesto sin tocar el sueldo', async () => {
    const s = build('ADMINISTRACION');
    await s.handler.execute(new UpdateEmployeeCommand(UID, 'emp-1', { jobTitle: 'Jefe' }));
    expect(s.employees.update).toHaveBeenCalled();
  });

  it('ADMINISTRACION con baseSalary distinto -> 403 EMPLOYEE_SALARY_GERENCIA_ONLY y no guarda nada', async () => {
    const s = build('ADMINISTRACION');
    const err = await s.handler.execute(new UpdateEmployeeCommand(UID, 'emp-1', { jobTitle: 'Jefe', baseSalary: 5000 })).catch((e) => e);
    expect(err).toBeInstanceOf(EmployeeSalaryGerenciaOnlyError);
    expect(err.httpStatus).toBe(403);
    expect(err.code).toBe('EMPLOYEE_SALARY_GERENCIA_ONLY');
    expect(s.employees.update).not.toHaveBeenCalled();
  });

  it('RRHH tampoco cambia el sueldo; pero reenviar el MISMO sueldo vigente no cuenta como cambio', async () => {
    const s = build('RRHH');
    await expect(s.handler.execute(new UpdateEmployeeCommand(UID, 'emp-1', { baseSalary: 3500 }))).rejects.toBeInstanceOf(EmployeeSalaryGerenciaOnlyError);
    await expect(s.handler.execute(new UpdateEmployeeCommand(UID, 'emp-1', { baseSalary: 3000, phone: '999' }))).resolves.toBeDefined();
  });

  it('quitar el sueldo (null) sin permiso tambien es cambio -> 403', async () => {
    const s = build('ADMINISTRACION');
    await expect(s.handler.execute(new UpdateEmployeeCommand(UID, 'emp-1', { baseSalary: null }))).rejects.toBeInstanceOf(EmployeeSalaryGerenciaOnlyError);
  });

  it('GERENCIA si cambia el sueldo base', async () => {
    const s = build('GERENCIA');
    await s.handler.execute(new UpdateEmployeeCommand(UID, 'emp-1', { baseSalary: 4200 }));
    expect(s.employees.update).toHaveBeenCalledWith('emp-1', expect.objectContaining({ baseSalary: 4200 }), s.tm.tx);
  });

  it('vaciar el correo de una ficha vinculada la deja DESVINCULADA sin error (UNLINKED)', async () => {
    const linked = buildEmployee({ email: 'ana@kairos.pe', firebaseUid: 'uid-ana' });
    const employees = {
      findById: jest.fn().mockResolvedValue(linked),
      update: jest.fn().mockImplementation(async (_id: string, data: Record<string, unknown>) => ({ ...linked, ...data })),
    } as unknown as jest.Mocked<EmployeeRepositoryPort>;
    const accountLinker = {
      planRelinkOnEmailChange: jest.fn().mockResolvedValue(null),
      applyRelink: jest.fn().mockResolvedValue({ employee: { ...linked, email: null, firebaseUid: null }, action: 'EMPLOYEE_ACCOUNT_UNLINKED' }),
      tryLink: jest.fn().mockImplementation(async (e) => e),
    };
    const audit = buildAudit();
    const handler = new UpdateEmployeeHandler(ACCESS('ADMINISTRACION'), employees, buildTransactionManager(), audit, accountLinker as never);
    const result = await handler.executeDetailed(new UpdateEmployeeCommand(UID, 'emp-1', { email: '   ' }));
    expect(accountLinker.planRelinkOnEmailChange).toHaveBeenCalledWith(linked, null);
    expect(result.accountRelink).toBe('UNLINKED');
    expect(result.employee.firebaseUid).toBeNull();
    expect(audit.recordHrAdministrationEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'EMPLOYEE_ACCOUNT_UNLINKED' }), expect.anything());
  });
});

describe('Vacaciones por area POR EMPRESA (Respuestas #18)', () => {
  /** Repositorio en memoria que respeta el alcance de empresa, como la EXCLUDE de BD (empresa + area + rango). */
  function memoryVacations(): VacationRepositoryPort & { rows: VacationRequest[] } {
    const rows: VacationRequest[] = [];
    return {
      rows,
      create: jest.fn().mockImplementation(async (d: CreateVacationData) => {
        const row = { id: `v-${rows.length + 1}`, requestedAt: new Date(), createdAt: new Date(), updatedAt: new Date(), ...d, notes: d.notes ?? null, status: d.status ?? 'SOLICITADA', approvedById: d.approvedById ?? null, approvedAt: d.approvedAt ?? null } as VacationRequest;
        rows.push(row);
        return row;
      }),
      findActiveByCompany: jest.fn().mockImplementation(async (companyId: string) =>
        rows.filter((r) => r.operatingCompanyId === companyId)),
      findActiveByArea: jest.fn().mockImplementation(async (companyId: string, areaId: string) =>
        rows.filter((r) => r.operatingCompanyId === companyId && r.areaId === areaId)),
      findByEmployee: jest.fn(),
      findCalendar: jest.fn(),
    } as never;
  }

  function scheduler(vacations: VacationRepositoryPort, employee: ReturnType<typeof buildEmployee>) {
    const employees = { findById: jest.fn().mockResolvedValue(employee) } as unknown as jest.Mocked<EmployeeRepositoryPort>;
    const ctx = { authorize: jest.fn().mockResolvedValue({ organizationId: ORG_ID, companyId: employee.operatingCompanyId, branchId: employee.branchId, roleId: 'role-RRHH' }) };
    const access = new HrAdministrationAccessService(buildWorkContext('GERENCIA'), buildMatrixAuth());
    void ctx;
    return new ScheduleVacationHandler(access, vacations, employees, buildTransactionManager(), new FixedClock(), buildAudit());
  }

  const range = (from: string, to: string, id: string) => new ScheduleVacationCommand(UID, id, new Date(`${from}T00:00:00Z`), new Date(`${to}T00:00:00Z`));

  it('dos empresas con el MISMO codigo de area y fechas solapadas NO se bloquean entre si', async () => {
    const vacations = memoryVacations();
    const empA = buildEmployee({ id: 'emp-a', operatingCompanyId: 'company-A', areaId: 'OPERACIONES' });
    const empB = buildEmployee({ id: 'emp-b', operatingCompanyId: 'company-B', areaId: 'OPERACIONES' });
    await scheduler(vacations, empA).execute(range('2026-12-01', '2026-12-10', 'emp-a'));
    await expect(scheduler(vacations, empB).execute(range('2026-12-05', '2026-12-12', 'emp-b'))).resolves.toBeDefined();
    expect(vacations.rows.map((r) => r.operatingCompanyId)).toEqual(['company-A', 'company-B']);
  });

  it('dentro de la MISMA empresa el cupo de 1 persona por area sigue vigente', async () => {
    const vacations = memoryVacations();
    const e1 = buildEmployee({ id: 'emp-1', operatingCompanyId: 'company-A', areaId: 'OPERACIONES' });
    const e2 = buildEmployee({ id: 'emp-2', operatingCompanyId: 'company-A', areaId: 'OPERACIONES' });
    await scheduler(vacations, e1).execute(range('2026-12-01', '2026-12-10', 'emp-1'));
    await expect(scheduler(vacations, e2).execute(range('2026-12-05', '2026-12-12', 'emp-2'))).rejects.toBeInstanceOf(VacationOverlapError);
  });

  it('el repositorio Prisma filtra por empresa y la fila nueva guarda operatingCompanyId', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const create = jest.fn().mockResolvedValue({});
    const repo = new PrismaVacationRepository({ vacationRequest: { findMany, create } } as never);
    await repo.findActiveByArea('company-A', 'OPERACIONES');
    expect(findMany.mock.calls[0][0].where).toMatchObject({ operatingCompanyId: 'company-A', areaId: 'OPERACIONES' });
    await repo.create({ employeeId: 'e', operatingCompanyId: 'company-A', areaId: 'OPERACIONES', startDate: new Date(), endDate: new Date() });
    expect(create.mock.calls[0][0].data.operatingCompanyId).toBe('company-A');
  });
});

describe('Asistencia HU-29: ubicacion automatica opcional (Respuestas #20)', () => {
  const okLocation = { latitude: -12.0464, longitude: -77.0428, accuracy: 12.5 };

  it('resolveAttendanceLocation: sin ubicacion devuelve nulls (no bloquea)', () => {
    expect(resolveAttendanceLocation(undefined)).toEqual({ latitude: null, longitude: null, accuracy: null });
    expect(resolveAttendanceLocation(null)).toEqual({ latitude: null, longitude: null, accuracy: null });
  });

  it('acepta ubicacion valida, con o sin precision', () => {
    expect(resolveAttendanceLocation(okLocation)).toEqual(okLocation);
    expect(resolveAttendanceLocation({ latitude: 0, longitude: 0 })).toEqual({ latitude: 0, longitude: 0, accuracy: null });
  });

  it.each([
    ['latitud > 90', { latitude: 91, longitude: 0 }],
    ['latitud < -90', { latitude: -90.1, longitude: 0 }],
    ['longitud > 180', { latitude: 0, longitude: 180.5 }],
    ['longitud < -180', { latitude: 0, longitude: -181 }],
    ['precision negativa', { latitude: 0, longitude: 0, accuracy: -1 }],
    ['precision absurda', { latitude: 0, longitude: 0, accuracy: 100001 }],
    ['solo latitud', { latitude: 1, longitude: undefined as unknown as number }],
    ['NaN', { latitude: Number.NaN, longitude: 0 }],
  ])('rechaza con 422: %s', (_n, loc) => {
    expect(() => resolveAttendanceLocation(loc)).toThrow(InvalidAttendanceRecordError);
  });

  it('el handler guarda la ubicacion en el registro y NO falla si no viene', async () => {
    const employee = buildEmployee();
    const employees = { findById: jest.fn().mockResolvedValue(employee) } as unknown as jest.Mocked<EmployeeRepositoryPort>;
    const attendance = {
      findByEmployeeAndDate: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'a1', employeeId: 'emp-1', date: new Date(), status: 'FALTA_JUSTIFICADA', minutesLate: 0, deductionAmount: 0, evidenceKind: null, latitude: -12.0464, longitude: -77.0428 }),
    } as unknown as jest.Mocked<AttendanceRepositoryPort>;
    const handler = new LogAttendanceHandler(ACCESS('RRHH'), attendance, employees, buildTransactionManager(), buildAudit(), {} as HrMemoService);
    const mk = (location?: typeof okLocation | null) =>
      new LogAttendanceCommand(UID, 'emp-1', new Date('2026-10-08T00:00:00Z'), 'FALTA_JUSTIFICADA', undefined, undefined, null, null, null, null, location);
    await handler.execute(mk(okLocation));
    expect(attendance.create).toHaveBeenLastCalledWith(expect.objectContaining({ latitude: -12.0464, longitude: -77.0428, accuracy: 12.5 }), expect.anything());
    await handler.execute(mk());
    expect(attendance.create).toHaveBeenLastCalledWith(expect.objectContaining({ latitude: null, longitude: null, accuracy: null }), expect.anything());
    await expect(handler.execute(mk({ latitude: 100, longitude: 0 }))).rejects.toBeInstanceOf(InvalidAttendanceRecordError);
  });
});
