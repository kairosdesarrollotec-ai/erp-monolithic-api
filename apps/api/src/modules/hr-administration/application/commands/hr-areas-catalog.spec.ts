import { HrAreaNotFoundError, HrAreaRequiredError } from '../../domain/hr-administration-errors';
import {
  COMPANY_ID,
  buildAudit,
  buildEmployee,
  buildMatrixAuth,
  buildTransactionManager,
  buildWorkContext,
} from '../../testing/hr-administration-test-fixtures';
import { HrAdministrationAccessService } from '../services/hr-administration-access.service';
import { HrAreaResolverService } from '../services/hr-area-resolver.service';
import type { EmployeeRepositoryPort } from '../ports/employee-repository.port';
import type { HrAreaRepositoryPort, HrAreaView } from '../ports/hr-area-repository.port';
import { ListHrAreasHandler } from '../queries/list-hr-areas.handler';
import { ListHrAreasQuery } from '../queries/list-hr-areas.query';
import { CreateEmployeeCommand } from './create-employee.command';
import { CreateEmployeeHandler } from './create-employee.handler';
import { UpdateEmployeeCommand } from './update-employee.command';
import { UpdateEmployeeHandler } from './update-employee.handler';

const UID = 'uid-1';
const CATALOG: HrAreaView[] = [
  { code: 'ADMINISTRACION', name: 'Administración', description: null, sortOrder: 10 },
  { code: 'ATENCION_AL_CLIENTE', name: 'Atención al cliente', description: null, sortOrder: 50 },
  { code: 'OPERACIONES', name: 'Operaciones', description: 'Órgano de línea', sortOrder: 70 },
];

function areasMock(items: HrAreaView[] = CATALOG) {
  return { listActive: jest.fn().mockResolvedValue(items) } as unknown as jest.Mocked<HrAreaRepositoryPort>;
}
function employeesMock() {
  return {
    findById: jest.fn(), findByCompanyAndDocument: jest.fn(), create: jest.fn(), update: jest.fn(),
    findByFirebaseUid: jest.fn(), findActiveByEmail: jest.fn(), linkFirebaseUid: jest.fn(), setFirebaseUid: jest.fn(),
  } as unknown as jest.Mocked<EmployeeRepositoryPort>;
}

describe('HrAreaResolverService (H-02, DEC-ADP-AREAS-001..003)', () => {
  const resolver = (items?: HrAreaView[]) => new HrAreaResolverService(areasMock(items));
  const base = { operatingCompanyId: COMPANY_ID };

  it('areaCode del catalogo -> codigo y nombre oficiales (el codigo se normaliza)', async () => {
    await expect(resolver().resolve({ ...base, areaCode: ' atención al cliente ' })).resolves.toEqual({
      areaId: 'ATENCION_AL_CLIENTE', areaName: 'Atención al cliente', source: 'CATALOG',
    });
  });

  it('areaCode inexistente -> HR_AREA_NOT_FOUND (no cae a texto libre)', async () => {
    await expect(resolver().resolve({ ...base, areaCode: 'GERENCIA', areaName: 'Gerencia' })).rejects.toBeInstanceOf(HrAreaNotFoundError);
  });

  it('texto libre que coincide con el nombre (mayusculas/tildes) se guarda como el area del catalogo', async () => {
    for (const name of ['operaciones', ' OPERACIONES ', 'Operaciónes'.replace('ó', 'o')]) {
      await expect(resolver().resolve({ ...base, areaName: name })).resolves.toMatchObject({ areaId: 'OPERACIONES', areaName: 'Operaciones', source: 'CATALOG' });
    }
    await expect(resolver().resolve({ ...base, areaName: 'ATENCION al  CLIENTE', areaId: 'x' })).resolves.toMatchObject({ areaId: 'ATENCION_AL_CLIENTE', source: 'CATALOG' });
  });

  it('solo areaId con el codigo del catalogo tambien resuelve al catalogo', async () => {
    await expect(resolver().resolve({ ...base, areaId: 'administracion' })).resolves.toMatchObject({ areaId: 'ADMINISTRACION', areaName: 'Administración', source: 'CATALOG' });
  });

  it('texto libre fuera del catalogo sigue permitido, con areaId normalizado', async () => {
    await expect(resolver().resolve({ ...base, areaName: ' Taller Mecánico ' })).resolves.toEqual({ areaId: 'TALLER_MECANICO', areaName: 'Taller Mecánico', source: 'FREE_TEXT' });
    await expect(resolver().resolve({ ...base, areaName: 'Taller Mecánico', areaId: 'mecánica' })).resolves.toEqual({ areaId: 'MECANICA', areaName: 'Taller Mecánico', source: 'FREE_TEXT' });
  });

  it('sin catalogo en la empresa el texto libre se comporta como antes (normalizado)', async () => {
    await expect(resolver([]).resolve({ ...base, areaName: 'Operaciones' })).resolves.toEqual({ areaId: 'OPERACIONES', areaName: 'Operaciones', source: 'FREE_TEXT' });
    await expect(resolver([]).resolve({ ...base, areaCode: 'OPERACIONES' })).rejects.toBeInstanceOf(HrAreaNotFoundError);
  });

  it('sin ningun dato de area -> NONE', async () => {
    await expect(resolver().resolve({ ...base })).resolves.toEqual({ source: 'NONE' });
  });

  it('ADP-05: escrituras distintas del mismo area producen el MISMO areaId (el cupo no se parte)', async () => {
    const r = resolver();
    const a = await r.resolve({ ...base, areaName: 'operaciones' });
    const b = await r.resolve({ ...base, areaCode: 'OPERACIONES' });
    const c = await r.resolve({ ...base, areaName: 'Operaciones', areaId: 'OPERACIONES' });
    expect(new Set([a.areaId, b.areaId, c.areaId])).toEqual(new Set(['OPERACIONES']));
    // BR-ADP-002 (ScheduleVacationHandler -> findActiveByArea / EXCLUDE por area_id) compara por igualdad de areaId.
  });
});

describe('CreateEmployeeHandler con catalogo de areas (H-02)', () => {
  function setup() {
    const employees = employeesMock();
    const tm = buildTransactionManager();
    const access = new HrAdministrationAccessService(buildWorkContext('RRHH'), buildMatrixAuth());
    const resolver = new HrAreaResolverService(areasMock());
    const handler = new CreateEmployeeHandler(access, employees, tm, buildAudit(), undefined, resolver);
    employees.findByCompanyAndDocument.mockResolvedValue(null);
    employees.create.mockResolvedValue(buildEmployee());
    return { employees, tm, handler };
  }
  const cmd = (areaId: string, areaName: string, areaCode?: string | null) =>
    new CreateEmployeeCommand(UID, COMPANY_ID, 'branch-hr-1', 'DNI', '45678912', 'Ana', areaId, areaName, 'Aux', new Date(), null, null, null, null, areaCode);

  it('con areaCode guarda codigo y nombre del catalogo aunque areaId/areaName vayan vacios', async () => {
    const s = setup();
    await s.handler.execute(cmd('', '', 'ATENCION_AL_CLIENTE'));
    expect(s.employees.create).toHaveBeenCalledWith(
      expect.objectContaining({ areaId: 'ATENCION_AL_CLIENTE', areaName: 'Atención al cliente' }),
      s.tm.tx,
    );
  });

  it('texto libre equivalente al catalogo (compatibilidad) se guarda como el area del catalogo', async () => {
    const s = setup();
    await s.handler.execute(cmd('', 'operaciones'));
    expect(s.employees.create).toHaveBeenCalledWith(expect.objectContaining({ areaId: 'OPERACIONES', areaName: 'Operaciones' }), s.tm.tx);
  });

  it('texto libre fuera del catalogo sigue funcionando', async () => {
    const s = setup();
    await s.handler.execute(cmd('', 'Taller Mecánico'));
    expect(s.employees.create).toHaveBeenCalledWith(expect.objectContaining({ areaId: 'TALLER_MECANICO', areaName: 'Taller Mecánico' }), s.tm.tx);
  });

  it('areaCode inexistente -> HR_AREA_NOT_FOUND y no crea; sin area -> AREA_REQUIRED', async () => {
    const s = setup();
    await expect(s.handler.execute(cmd('', '', 'NOPE'))).rejects.toBeInstanceOf(HrAreaNotFoundError);
    await expect(s.handler.execute(cmd('', ''))).rejects.toBeInstanceOf(HrAreaRequiredError);
    expect(s.employees.create).not.toHaveBeenCalled();
  });
});

describe('UpdateEmployeeHandler con catalogo de areas (H-02)', () => {
  function setup() {
    const employees = employeesMock();
    const tm = buildTransactionManager();
    const access = new HrAdministrationAccessService(buildWorkContext('RRHH'), buildMatrixAuth());
    const handler = new UpdateEmployeeHandler(access, employees, tm, buildAudit(), undefined, new HrAreaResolverService(areasMock()));
    employees.findById.mockResolvedValue(buildEmployee({ areaId: 'TALLER', areaName: 'Taller' }));
    employees.update.mockResolvedValue(buildEmployee());
    return { employees, tm, handler };
  }

  it('areaCode se traduce a areaId/areaName y nunca llega al repositorio', async () => {
    const s = setup();
    await s.handler.execute(new UpdateEmployeeCommand(UID, 'emp-1', { areaCode: 'OPERACIONES', jobTitle: 'Jefe' }));
    const data = s.employees.update.mock.calls[0][1];
    expect(data).toEqual({ jobTitle: 'Jefe', areaId: 'OPERACIONES', areaName: 'Operaciones' });
    expect(data).not.toHaveProperty('areaCode');
  });

  it('texto libre editado que coincide con el catalogo se guarda como catalogo; si no, normalizado', async () => {
    const s = setup();
    await s.handler.execute(new UpdateEmployeeCommand(UID, 'emp-1', { areaName: 'atención AL cliente' }));
    expect(s.employees.update.mock.calls[0][1]).toEqual({ areaId: 'ATENCION_AL_CLIENTE', areaName: 'Atención al cliente' });
    await s.handler.execute(new UpdateEmployeeCommand(UID, 'emp-1', { areaName: 'Almacén' }));
    expect(s.employees.update.mock.calls[1][1]).toEqual({ areaId: 'ALMACEN', areaName: 'Almacén' });
  });

  it('areaCode inexistente -> 422 y no actualiza; sin campos de area no toca el catalogo', async () => {
    const s = setup();
    await expect(s.handler.execute(new UpdateEmployeeCommand(UID, 'emp-1', { areaCode: 'NOPE' }))).rejects.toBeInstanceOf(HrAreaNotFoundError);
    expect(s.employees.update).not.toHaveBeenCalled();
    await s.handler.execute(new UpdateEmployeeCommand(UID, 'emp-1', { jobTitle: 'Jefe' }));
    expect(s.employees.update.mock.calls[0][1]).toEqual({ jobTitle: 'Jefe' });
  });
});

describe('ListHrAreasHandler (H-02)', () => {
  it('lista el catalogo de la empresa del contexto autorizado', async () => {
    const areas = areasMock();
    const access = new HrAdministrationAccessService(buildWorkContext('RRHH'), buildMatrixAuth());
    const result = await new ListHrAreasHandler(access, areas).execute(new ListHrAreasQuery(UID, COMPANY_ID, 'branch-hr-1'));
    expect(result).toEqual(CATALOG.map((a) => ({ ...a, isActive: true })));
    expect(areas.listActive).toHaveBeenCalledWith(COMPANY_ID);
  });
});
