import { ForbiddenException } from '@nestjs/common';
import { RecordZoneMarksHandler } from './record-zone-marks.handler';
import { RecordZoneMarksCommand } from './record-zone-marks.command';
import { ListZoneMarksHandler } from '../queries/list-zone-marks.handler';
import { ListZoneMarksQuery } from '../queries/list-zone-marks.query';
import { InvalidZoneMarkError, ReturnNotFoundError, ReturnStateConflictError } from '../../domain/return-errors';
import { RETURN_ZONE_MARK_ZONES, ReturnZoneMarkRecord, ReturnZoneMarkValue } from '../../domain/return-zone-marks';
import { ReturnZoneMarkRepositoryPort } from '../ports/return-zone-mark-repository.port';
import { buildDeps, buildReturnRecord } from '../../testing/return-test-fixtures';

function fakeMarks(): jest.Mocked<ReturnZoneMarkRepositoryPort> & { rows: Map<string, ReturnZoneMarkRecord> } {
  const rows = new Map<string, ReturnZoneMarkRecord>();
  return {
    rows,
    list: jest.fn(async () => [...rows.values()]),
    upsertMany: jest.fn(async (input) => {
      for (const m of input.marks) {
        rows.set(m.zone, { zone: m.zone as never, mark: m.mark, markedBy: input.markedBy, markedAt: input.markedAt });
      }
    }),
  } as never;
}

describe('RecordZoneMarksHandler (DEV-05 / PD-07)', () => {
  function build(role: Parameters<typeof buildDeps>[0] extends infer O ? (O extends { role?: infer R } ? R : never) : never = 'FRONT_OFFICE', status: 'INSPECCION' | 'SIN_DANOS' = 'INSPECCION') {
    const deps = buildDeps({ role });
    deps.returns.findById.mockResolvedValue(buildReturnRecord({ status }));
    const marks = fakeMarks();
    const handler = new RecordZoneMarksHandler(deps.access, deps.returns, marks, deps.transactionManager, deps.clock, deps.auditRepository);
    return { deps, marks, handler };
  }
  const cmd = (items: Array<{ zone: string; mark: string }>) => new RecordZoneMarksCommand('ret-1', 'uid-1', 'comp-1', 'branch-1', items);
  const all = (mark: ReturnZoneMarkValue, except?: { zone: string; mark: string }) =>
    RETURN_ZONE_MARK_ZONES.map((zone) => (except && except.zone === zone ? except : { zone, mark }));
  const actions = (deps: ReturnType<typeof build>['deps']) => deps.auditRepository.recordRentalEvent.mock.calls.map((c) => c[0].action);

  it('marca parcial: persiste y audita RETURN_ZONE_MARKED sin ruta (faltan zonas)', async () => {
    const { deps, marks, handler } = build();
    const result = await handler.execute(cmd([{ zone: 'FRONTAL', mark: 'NO_DAMAGE' }]));
    expect(result).toMatchObject({ complete: false, route: null });
    expect(marks.upsertMany).toHaveBeenCalledTimes(1);
    expect(actions(deps)).toEqual(['RETURN_ZONE_MARKED']);
  });

  it('las 5 zonas sin daño: ruta NO_DAMAGE y evento RETURN_ROUTE_TAKEN', async () => {
    const { deps, handler } = build();
    const result = await handler.execute(cmd(all('NO_DAMAGE')));
    expect(result).toMatchObject({ complete: true, route: 'NO_DAMAGE' });
    expect(actions(deps).filter((a) => a === 'RETURN_ZONE_MARKED')).toHaveLength(5);
    const route = deps.auditRepository.recordRentalEvent.mock.calls.find((c) => c[0].action === 'RETURN_ROUTE_TAKEN')![0];
    expect(route.changes).toMatchObject({ route: 'NO_DAMAGE', previousRoute: null, damagedZones: [] });
  });

  it('una zona con daño: ruta DAMAGE con la zona dañada; cambiar la marca después emite un nuevo RETURN_ROUTE_TAKEN', async () => {
    const { deps, handler } = build();
    const first = await handler.execute(cmd(all('NO_DAMAGE', { zone: 'POSTERIOR', mark: 'DAMAGE' })));
    expect(first.route).toBe('DAMAGE');
    deps.auditRepository.recordRentalEvent.mockClear();

    const second = await handler.execute(cmd([{ zone: 'POSTERIOR', mark: 'NO_DAMAGE' }]));
    expect(second.route).toBe('NO_DAMAGE');
    const events = deps.auditRepository.recordRentalEvent.mock.calls.map((c) => c[0]);
    expect(events.map((e) => e.action)).toEqual(['RETURN_ZONE_MARKED', 'RETURN_ROUTE_TAKEN']);
    expect(events[0].changes).toMatchObject({ zone: 'POSTERIOR', mark: 'NO_DAMAGE', previousMark: 'DAMAGE' });
    expect(events[1].changes).toMatchObject({ route: 'NO_DAMAGE', previousRoute: 'DAMAGE' });
  });

  it('idempotente: repetir las mismas marcas no escribe ni audita', async () => {
    const { deps, marks, handler } = build();
    await handler.execute(cmd(all('NO_DAMAGE')));
    marks.upsertMany.mockClear();
    deps.auditRepository.recordRentalEvent.mockClear();
    const again = await handler.execute(cmd(all('NO_DAMAGE')));
    expect(again).toMatchObject({ complete: true, route: 'NO_DAMAGE' });
    expect(marks.upsertMany).not.toHaveBeenCalled();
    expect(deps.auditRepository.recordRentalEvent).not.toHaveBeenCalled();
  });

  it('valida zona, marca, repetidos y lista vacía (422 INVALID_ZONE_MARK) sin tocar nada', async () => {
    const { marks, handler } = build();
    for (const items of [[], [{ zone: 'TECHO', mark: 'DAMAGE' }], [{ zone: 'FRONTAL', mark: 'OK' }], [{ zone: 'FRONTAL', mark: 'DAMAGE' }, { zone: 'FRONTAL', mark: 'NO_DAMAGE' }]]) {
      const error = await handler.execute(cmd(items)).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(InvalidZoneMarkError);
      expect((error as InvalidZoneMarkError).code).toBe('INVALID_ZONE_MARK');
    }
    expect(marks.upsertMany).not.toHaveBeenCalled();
  });

  it('devolución inexistente -> 404; ya resuelta (SIN_DANOS) -> 409', async () => {
    const missing = build();
    missing.deps.returns.findById.mockResolvedValue(null);
    await expect(missing.handler.execute(cmd(all('NO_DAMAGE')))).rejects.toBeInstanceOf(ReturnNotFoundError);

    const resolved = build('FRONT_OFFICE', 'SIN_DANOS');
    await expect(resolved.handler.execute(cmd(all('NO_DAMAGE')))).rejects.toBeInstanceOf(ReturnStateConflictError);
  });

  it('exige COMPLETE_INSPECTION: AUDITORIA y FINANZAS no marcan (403)', async () => {
    for (const role of ['AUDITORIA', 'FINANZAS'] as const) {
      const { marks, handler } = build(role);
      await expect(handler.execute(cmd(all('NO_DAMAGE')))).rejects.toBeInstanceOf(ForbiddenException);
      expect(marks.upsertMany).not.toHaveBeenCalled();
    }
  });
});

describe('ListZoneMarksHandler (DEV-05 / PD-07)', () => {
  it('devuelve marcas y ruta; AUDITORIA puede leer', async () => {
    const deps = buildDeps({ role: 'AUDITORIA' });
    deps.returns.findById.mockResolvedValue(buildReturnRecord({ status: 'INSPECCION' }));
    const marks = fakeMarks();
    for (const zone of RETURN_ZONE_MARK_ZONES) {
      marks.rows.set(zone, { zone, mark: 'NO_DAMAGE', markedBy: 'uid-1', markedAt: new Date('2026-10-22T10:00:00Z') });
    }
    const handler = new ListZoneMarksHandler(deps.access, deps.returns, marks);
    const result = await handler.execute(new ListZoneMarksQuery('ret-1', 'uid-1', 'comp-1', 'branch-1'));
    expect(result).toMatchObject({ returnId: 'ret-1', complete: true, route: 'NO_DAMAGE' });
    expect(result.marks).toHaveLength(5);
  });

  it('devolución inexistente -> 404', async () => {
    const deps = buildDeps({ role: 'FRONT_OFFICE' });
    deps.returns.findById.mockResolvedValue(null);
    const handler = new ListZoneMarksHandler(deps.access, deps.returns, fakeMarks());
    await expect(handler.execute(new ListZoneMarksQuery('x', 'uid-1', 'comp-1', 'branch-1'))).rejects.toBeInstanceOf(ReturnNotFoundError);
  });
});
