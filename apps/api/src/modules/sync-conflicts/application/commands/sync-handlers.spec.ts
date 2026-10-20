import { ForbiddenException } from '@nestjs/common';
import { InMemorySyncStateRepository, RENTAL_ID, SOURCE_ID, SYNC_NOW } from '../../testing/sync-test-fixtures';
import { SyncAccessService } from '../services/sync-access.service';
import { SyncChecklistHandler } from './sync-checklist.handler';
import { SyncChecklistCommand } from './sync-checklist.command';
import { ResolveSyncConflictHandler } from './resolve-sync-conflict.handler';
import { ResolveSyncConflictCommand } from './resolve-sync-conflict.command';
import { GetChecklistSyncStatusHandler } from '../queries/get-checklist-sync-status.handler';
import { GetChecklistSyncStatusQuery } from '../queries/sync-queries';
import { SyncClosureGateService } from '../services/sync-closure-gate.service';
import {
  SyncConfirmationRequiredError,
  SyncConflictAlreadyOpenError,
  SyncConflictAlreadyResolvedError,
  SyncConflictPendingError,
  SyncConflictVersionMismatchError,
  SyncDraftExpiredError,
  SyncDraftRejectedError,
  SyncMergeNotAllowedError,
  SyncPaymentOnlineOnlyError,
  SyncReasonRequiredError,
  SyncSourceNotFoundError,
} from '../../domain/sync-errors';
import type { IncomingField } from '../../domain/sync-conflict-matrix';
import type { IncomingEvidence } from '../../domain/sync-evidence-merge';
import type { SyncChecklistType } from '../../domain/sync-types';

const H1 = 'a'.repeat(64);
const H2 = 'b'.repeat(64);
const CONTEXT = { organizationId: 'org-1', companyId: 'comp-1', branchId: 'branch-1', roleId: 'role-CAMPO', roleName: 'CAMPO', roleKey: 'CAMPO' };

const field = (key: string, value: IncomingField['value'], baseRev = 0, dataType: IncomingField['dataType'] = 'CHECKLIST'): IncomingField => ({
  key,
  dataType,
  value,
  baseRev,
  editedAt: '2026-10-19T14:00:00.000Z',
});
const evidenceNoSlot = (id: string, hash: string): IncomingEvidence => {
  const { slot: _slot, ...rest } = evidence(id, 1, hash);
  return rest;
};
const evidence = (id: string, slot: number, hash: string): IncomingEvidence => ({
  clientCaptureId: id,
  zone: 'INTERIOR',
  slot,
  type: 'PHOTO',
  contentHash: hash,
  sizeBytes: 100,
  capturedAt: '2026-10-19T14:00:00.000Z',
  deviceId: 'dev-1',
});

function build(opts: { type?: SyncChecklistType; acceptsDrafts?: boolean; sourceExists?: boolean; deniedActions?: string[] } = {}) {
  const type = opts.type ?? 'RECEPCION';
  const repo = new InMemorySyncStateRepository();
  const audit = { recordRentalEvent: jest.fn().mockResolvedValue(undefined) };
  const outbox = { publish: jest.fn().mockResolvedValue(undefined) };
  const sources = {
    find: jest.fn().mockResolvedValue(
      opts.sourceExists === false ? null : { sourceId: SOURCE_ID, rentalId: RENTAL_ID, status: 'INSPECCION', acceptsDrafts: opts.acceptsDrafts ?? true },
    ),
  };
  const workContext = { authorize: jest.fn().mockResolvedValue(CONTEXT) };
  const denied = new Set(opts.deniedActions ?? []);
  const matrixAuth = {
    assertAllowed: jest.fn().mockImplementation((_o: string, _r: string, module: string, action: string) => {
      if (denied.has(`${module}.${action}`)) throw new ForbiddenException({ code: 'ROLE_NOT_ALLOWED', detail: 'no' });
      return Promise.resolve();
    }),
  };
  const access = new SyncAccessService(workContext as never, matrixAuth as never);
  const tm = { run: jest.fn().mockImplementation((work: (tx: unknown) => unknown) => work({})) };
  const clock = { now: () => SYNC_NOW };
  const sync = new SyncChecklistHandler(access, sources as never, repo, tm as never, clock as never, audit as never, outbox as never);
  const resolve = new ResolveSyncConflictHandler(access, repo, tm as never, clock as never, audit as never, outbox as never);
  const gate = new SyncClosureGateService(repo);
  const status = new GetChecklistSyncStatusHandler(access, sources as never, repo);
  const syncCmd = (fields: IncomingField[], evidenceItems: IncomingEvidence[] = [], draftCreatedAt = new Date('2026-10-19T10:00:00.000Z'), uid = 'uid-campo') =>
    new SyncChecklistCommand(type, SOURCE_ID, uid, 'comp-1', 'branch-1', 'dev-1', draftCreatedAt, fields, evidenceItems);
  const resolveCmd = (conflictId: string, over: Partial<ResolveSyncConflictCommand> = {}) =>
    Object.assign(
      new ResolveSyncConflictCommand(conflictId, 'uid-sup', 'comp-1', 'branch-1', 1, 'KEEP_LOCAL', 'Verifique el tablero en sitio', true),
      over,
    );
  return { repo, audit, outbox, sources, matrixAuth, sync, resolve, gate, status, syncCmd, resolveCmd, type };
}

describe('SyncChecklistHandler (detectar)', () => {
  it('sin choque: aplica los campos, agrega evidencia y el SERVIDOR confirma SYNCED', async () => {
    const t = build();
    const r = await t.sync.execute(t.syncCmd([field('mileage', 1200), field('fuel', 'FULL')], [evidence('c1', 1, H1)]));
    expect(r.status).toBe('SYNCED');
    expect(r.serverConfirmedAt).toEqual(SYNC_NOW);
    expect(r.appliedFields.sort()).toEqual(['fuel', 'mileage']);
    expect(r.addedEvidence).toEqual(['c1']);
    expect(r.conflicts).toEqual([]);
    expect(t.repo.states[0].fields.mileage).toMatchObject({ value: 1200, rev: 1, updatedBy: 'uid-campo' });
    expect(t.outbox.publish).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'ChecklistSincronizado.v1' }), expect.anything());
    expect(t.audit.recordRentalEvent).toHaveBeenCalledWith(
      expect.objectContaining({ rentalId: RENTAL_ID, action: 'SYNC_CHECKLIST_SYNCED' }),
      expect.anything(),
    );
  });

  it('campos distintos de dos actores se combinan sin conflicto', async () => {
    const t = build();
    await t.sync.execute(t.syncCmd([field('mileage', 1200)], [], undefined, 'uid-a'));
    const r = await t.sync.execute(t.syncCmd([field('fuel', 'HALF')], [], undefined, 'uid-b'));
    expect(r.status).toBe('SYNCED');
    expect(Object.keys(t.repo.states[0].fields).sort()).toEqual(['fuel', 'mileage']);
  });

  it('mismo campo por dos actores: crea conflicto ABIERTO, estado SYNC_CONFLICT, sin confirmar y SIN sobrescribir', async () => {
    const t = build();
    await t.sync.execute(t.syncCmd([field('fuel', 'HALF')], [], undefined, 'uid-a'));
    const r = await t.sync.execute(t.syncCmd([field('fuel', 'FULL', 0)], [], undefined, 'uid-b'));
    expect(r.status).toBe('SYNC_CONFLICT');
    expect(r.serverConfirmedAt).toBeNull();
    expect(r.conflicts).toHaveLength(1);
    expect(r.conflicts[0]).toMatchObject({ kind: 'FIELD', key: 'fuel', status: 'OPEN', detectedBy: 'uid-b' });
    expect(t.repo.states[0].fields.fuel.value).toBe('HALF');
    expect(t.audit.recordRentalEvent).toHaveBeenLastCalledWith(expect.objectContaining({ action: 'SYNC_CONFLICT_DETECTED' }), expect.anything());
    expect(t.outbox.publish).toHaveBeenLastCalledWith(
      expect.objectContaining({ eventType: 'ConflictoSincronizacionDetectado.v1' }),
      expect.anything(),
    );
  });

  it('evidencia: mismo contentHash no se duplica; slot ocupado con otro hash es conflicto de EVIDENCE', async () => {
    const t = build();
    await t.sync.execute(t.syncCmd([], [evidence('c1', 1, H1)]));
    const dup = await t.sync.execute(t.syncCmd([], [evidence('c2', 2, H1)]));
    expect(dup.duplicateEvidence).toHaveLength(1);
    expect(t.repo.states[0].evidence).toHaveLength(1);
    const clash = await t.sync.execute(t.syncCmd([], [evidence('c3', 1, H2)]));
    expect(clash.status).toBe('SYNC_CONFLICT');
    expect(clash.conflicts[0]).toMatchObject({ kind: 'EVIDENCE', key: 'INTERIOR#1' });
    expect(t.repo.states[0].evidence).toHaveLength(1);
  });

  it('1.1.0 fieldRevisions: la respuesta trae la revision vigente y usarla como baseRev evita el conflicto contra uno mismo', async () => {
    const t = build();
    const first = await t.sync.execute(t.syncCmd([field('fuel', 'HALF')]));
    expect(first.fieldRevisions).toEqual([{ key: 'fuel', rev: 1, value: 'HALF' }]);
    const again = await t.sync.execute(t.syncCmd([field('fuel', 'FULL', first.fieldRevisions[0].rev)]));
    expect(again.status).toBe('SYNCED');
    expect(again.fieldRevisions).toEqual([{ key: 'fuel', rev: 2, value: 'FULL' }]);
    // cliente 1.0.0 (baseRev 0) conserva el comportamiento anterior: choque
    const legacy = await t.sync.execute(t.syncCmd([field('fuel', 'EMPTY', 0)]));
    expect(legacy.status).toBe('SYNC_CONFLICT');
  });

  it('1.1.0 GET status devuelve fieldRevisions del estado (vacio sin estado previo)', async () => {
    const t = build();
    const query = new GetChecklistSyncStatusQuery(t.type, SOURCE_ID, 'uid-campo', 'comp-1', 'branch-1');
    const empty = await t.status.execute(query);
    expect(empty.fieldRevisions).toEqual([]);
    await t.sync.execute(t.syncCmd([field('fuel', 'HALF'), field('mileage', 10)]));
    const after = await t.status.execute(query);
    expect(after.fieldRevisions).toEqual([
      { key: 'fuel', rev: 1, value: 'HALF' },
      { key: 'mileage', rev: 1, value: 10 },
    ]);
  });

  it('1.1.0 slot: sin slot el servidor asigna el libre; no hay conflicto con una toma previa de otro hash en el slot 1', async () => {
    const t = build();
    await t.sync.execute(t.syncCmd([], [evidence('c1', 1, H1)]));
    const r = await t.sync.execute(t.syncCmd([], [evidenceNoSlot('c2', H2)]));
    expect(r.status).toBe('SYNCED');
    expect(r.addedEvidence).toEqual(['c2']);
    expect(r.evidenceSlots).toEqual([{ clientCaptureId: 'c2', zone: 'INTERIOR', slot: 2, outcome: 'ADDED', assignedByServer: true }]);
    expect(t.repo.states[0].evidence.map((e) => e.slot)).toEqual([1, 2]);
  });

  it('1.1.0 slot: reenviar la misma captura (con o sin slot) es idempotente y devuelve el slot existente, sin duplicar ni chocar', async () => {
    const t = build();
    await t.sync.execute(t.syncCmd([], [evidenceNoSlot('c1', H1)]));
    const retry = await t.sync.execute(t.syncCmd([], [evidenceNoSlot('c1', H1)]));
    const sameHash = await t.sync.execute(t.syncCmd([], [evidence('c9', 4, H1)]));
    expect(retry.duplicateEvidence).toEqual([{ clientCaptureId: 'c1', reason: 'SAME_CAPTURE', existingClientCaptureId: 'c1', existingSlot: 1 }]);
    expect(sameHash.duplicateEvidence[0]).toMatchObject({ reason: 'SAME_CONTENT_HASH', existingSlot: 1 });
    expect(sameHash.evidenceSlots[0]).toMatchObject({ slot: 1, outcome: 'DUPLICATE' });
    expect(sameHash.status).toBe('SYNCED');
    expect(t.repo.states[0].evidence).toHaveLength(1);
    expect(t.repo.conflicts).toHaveLength(0);
  });

  it('un reintento identico no duplica el conflicto (idempotente); uno distinto exige resolver primero', async () => {
    const t = build();
    await t.sync.execute(t.syncCmd([field('fuel', 'HALF')], [], undefined, 'uid-a'));
    await t.sync.execute(t.syncCmd([field('fuel', 'FULL', 0)], [], undefined, 'uid-b'));
    const retry = await t.sync.execute(t.syncCmd([field('fuel', 'FULL', 0)], [], undefined, 'uid-b'));
    expect(retry.conflicts).toHaveLength(1);
    expect(t.repo.conflicts).toHaveLength(1);
    await expect(t.sync.execute(t.syncCmd([field('fuel', 'EMPTY', 0)], [], undefined, 'uid-b'))).rejects.toBeInstanceOf(SyncConflictAlreadyOpenError);
  });

  it('matriz: disponibilidad/reserva/estado del vehiculo prevalece el servidor (se descarta, sin conflicto)', async () => {
    const t = build();
    const r = await t.sync.execute(t.syncCmd([field('fuel', 'FULL'), field('vehicleStatus', 'RENTED', 0, 'VEHICLE_STATE')]));
    expect(r.status).toBe('SYNCED');
    expect(r.discardedFields.map((d) => d.key)).toEqual(['vehicleStatus']);
    expect(t.repo.states[0].fields.vehicleStatus).toBeUndefined();
  });

  it('matriz: el pago nunca se sincroniza offline (422) y no deja rastro', async () => {
    const t = build();
    await expect(t.sync.execute(t.syncCmd([field('amount', 100, 0, 'PAYMENT')]))).rejects.toBeInstanceOf(SyncPaymentOnlineOnlyError);
    expect(t.repo.states).toHaveLength(0);
  });

  it('rechaza el borrador de un expediente ya confirmado/cerrado/cancelado (SDD 17.3)', async () => {
    const t = build({ acceptsDrafts: false });
    await expect(t.sync.execute(t.syncCmd([field('fuel', 'FULL')]))).rejects.toBeInstanceOf(SyncDraftRejectedError);
  });

  it('expediente fuera de la empresa/sede: 404', async () => {
    const t = build({ sourceExists: false });
    await expect(t.sync.execute(t.syncCmd([field('fuel', 'FULL')]))).rejects.toBeInstanceOf(SyncSourceNotFoundError);
  });

  it('borrador de mas de 72 h: SYNC_DRAFT_EXPIRED', async () => {
    const t = build();
    await expect(t.sync.execute(t.syncCmd([field('fuel', 'FULL')], [], new Date('2026-10-16T14:59:00.000Z')))).rejects.toBeInstanceOf(SyncDraftExpiredError);
    await expect(t.sync.execute(t.syncCmd([field('fuel', 'FULL')], [], new Date('2026-10-16T15:01:00.000Z')))).resolves.toBeDefined();
  });

  it('autoriza con la accion existente del modulo (ENTREGA -> RENTAL.UPLOAD_EVIDENCE) y respeta deny-by-default', async () => {
    const t = build({ type: 'ENTREGA', deniedActions: ['RENTAL.UPLOAD_EVIDENCE'] });
    await expect(t.sync.execute(t.syncCmd([field('fuel', 'FULL')]))).rejects.toBeInstanceOf(ForbiddenException);
    expect(t.matrixAuth.assertAllowed).toHaveBeenCalledWith('org-1', 'role-CAMPO', 'RENTAL', 'UPLOAD_EVIDENCE', { companyId: 'comp-1', branchId: 'branch-1' });
  });
});

describe('ResolveSyncConflictHandler (resolver)', () => {
  async function withFieldConflict(type: SyncChecklistType = 'RECEPCION') {
    const t = build({ type });
    await t.sync.execute(t.syncCmd([field('fuel', 'HALF')], [], undefined, 'uid-a'));
    await t.sync.execute(t.syncCmd([field('fuel', 'FULL', 0)], [], undefined, 'uid-b'));
    return { t, conflict: t.repo.conflicts[0] };
  }

  it('KEEP_LOCAL: aplica el valor local, audita con reason, publica evento y vuelve a SYNCED (confirmado por el servidor)', async () => {
    const { t, conflict } = await withFieldConflict();
    const r = await t.resolve.execute(t.resolveCmd(conflict.id));
    expect(r.conflict).toMatchObject({ status: 'RESOLVED', resolution: 'KEEP_LOCAL', resolvedBy: 'uid-sup', version: 2 });
    expect(r.checklistStatus).toBe('SYNCED');
    expect(r.serverConfirmedAt).toEqual(SYNC_NOW);
    expect(t.repo.states[0].fields.fuel).toMatchObject({ value: 'FULL', rev: 2 });
    expect(t.audit.recordRentalEvent).toHaveBeenLastCalledWith(
      expect.objectContaining({
        rentalId: RENTAL_ID,
        actorUserId: 'uid-sup',
        action: 'SYNC_CONFLICT_RESOLVED',
        changes: expect.objectContaining({ resolution: 'KEEP_LOCAL', reason: 'Verifique el tablero en sitio', key: 'fuel' }),
      }),
      expect.anything(),
    );
    expect(t.outbox.publish).toHaveBeenLastCalledWith(expect.objectContaining({ eventType: 'ConflictoSincronizacionResuelto.v1' }), expect.anything());
  });

  it('KEEP_SERVER: conserva el valor del servidor pero igual audita y resuelve', async () => {
    const { t, conflict } = await withFieldConflict();
    await t.resolve.execute(t.resolveCmd(conflict.id, { resolution: 'KEEP_SERVER' }));
    expect(t.repo.states[0].fields.fuel).toMatchObject({ value: 'HALF', rev: 1 });
    expect(t.audit.recordRentalEvent).toHaveBeenLastCalledWith(expect.objectContaining({ action: 'SYNC_CONFLICT_RESOLVED' }), expect.anything());
  });

  it('nunca se resuelve sola: sin confirmed=true o sin reason -> 422 y el conflicto sigue abierto', async () => {
    const { t, conflict } = await withFieldConflict();
    await expect(t.resolve.execute(t.resolveCmd(conflict.id, { confirmed: false }))).rejects.toBeInstanceOf(SyncConfirmationRequiredError);
    await expect(t.resolve.execute(t.resolveCmd(conflict.id, { reason: 'corto' }))).rejects.toBeInstanceOf(SyncReasonRequiredError);
    expect(t.repo.conflicts[0].status).toBe('OPEN');
    expect(t.repo.states[0].status).toBe('SYNC_CONFLICT');
  });

  it('"Combinar" no aplica a un campo que choca (422)', async () => {
    const { t, conflict } = await withFieldConflict();
    await expect(t.resolve.execute(t.resolveCmd(conflict.id, { resolution: 'MERGE' }))).rejects.toBeInstanceOf(SyncMergeNotAllowedError);
  });

  it('exige rol supervisor: RECEPCION -> RETURN.CLOSE, ENTREGA -> RENTAL.MANAGE_CONTRACT_TEMPLATES (403 si la matriz lo niega)', async () => {
    const r1 = await withFieldConflict('RECEPCION');
    r1.t.matrixAuth.assertAllowed.mockImplementation((_o: string, _r: string, m: string, a: string) =>
      m === 'RETURN' && a === 'CLOSE' ? Promise.reject(new ForbiddenException({ code: 'ROLE_NOT_ALLOWED' })) : Promise.resolve(),
    );
    await expect(r1.t.resolve.execute(r1.t.resolveCmd(r1.conflict.id))).rejects.toBeInstanceOf(ForbiddenException);
    expect(r1.t.repo.conflicts[0].status).toBe('OPEN');

    const r2 = await withFieldConflict('ENTREGA');
    await r2.t.resolve.execute(r2.t.resolveCmd(r2.conflict.id));
    expect(r2.t.matrixAuth.assertAllowed).toHaveBeenCalledWith('org-1', 'role-CAMPO', 'RENTAL', 'MANAGE_CONTRACT_TEMPLATES', { companyId: 'comp-1', branchId: 'branch-1' });
  });

  it('If-Match: version distinta -> 412; ya resuelto -> 409', async () => {
    const { t, conflict } = await withFieldConflict();
    await expect(t.resolve.execute(t.resolveCmd(conflict.id, { expectedVersion: 9 }))).rejects.toBeInstanceOf(SyncConflictVersionMismatchError);
    await t.resolve.execute(t.resolveCmd(conflict.id));
    await expect(t.resolve.execute(t.resolveCmd(conflict.id, { expectedVersion: 2 }))).rejects.toBeInstanceOf(SyncConflictAlreadyResolvedError);
  });

  it('conflicto de EVIDENCIA: MERGE conserva ambas tomas (principal + anexo) y vuelve a SYNCED', async () => {
    const t = build();
    await t.sync.execute(t.syncCmd([], [evidence('c1', 1, H1)]));
    await t.sync.execute(t.syncCmd([], [evidence('c2', 1, H2)]));
    const conflict = t.repo.conflicts[0];
    expect(conflict.kind).toBe('EVIDENCE');
    const r = await t.resolve.execute(t.resolveCmd(conflict.id, { resolution: 'MERGE' }));
    expect(r.checklistStatus).toBe('SYNCED');
    expect(t.repo.states[0].evidence.map((e) => `${e.clientCaptureId}:${e.role}`).sort()).toEqual(['c1:PRIMARY', 'c2:ANNEX']);
  });

  it('con dos conflictos, resolver uno deja SYNC_CONFLICT hasta resolver el ultimo', async () => {
    const t = build();
    await t.sync.execute(t.syncCmd([field('fuel', 'HALF'), field('mileage', 10)], [], undefined, 'uid-a'));
    await t.sync.execute(t.syncCmd([field('fuel', 'FULL', 0), field('mileage', 99, 0)], [], undefined, 'uid-b'));
    expect(t.repo.conflicts).toHaveLength(2);
    const first = await t.resolve.execute(t.resolveCmd(t.repo.conflicts[0].id));
    expect(first.checklistStatus).toBe('SYNC_CONFLICT');
    expect(first.serverConfirmedAt).toBeNull();
    const second = await t.resolve.execute(t.resolveCmd(t.repo.conflicts[1].id));
    expect(second.checklistStatus).toBe('SYNCED');
  });

  it('el conflicto de otra sede no existe para este usuario (404)', async () => {
    const { t, conflict } = await withFieldConflict();
    await expect(t.resolve.execute(t.resolveCmd(conflict.id, { branchId: 'otra-sede' }))).rejects.toThrow(/no encontrado/);
  });

  it('el cierre queda bloqueado (SYNC_CONFLICT_PENDING) mientras haya conflicto y se libera al resolverlo', async () => {
    const { t, conflict } = await withFieldConflict();
    const scope = { organizationId: 'org-1', operatingCompanyId: 'comp-1' };
    await expect(t.gate.assertSynced('RECEPCION', SOURCE_ID, scope)).rejects.toBeInstanceOf(SyncConflictPendingError);
    await t.resolve.execute(t.resolveCmd(conflict.id));
    await expect(t.gate.assertSynced('RECEPCION', SOURCE_ID, scope)).resolves.toBeUndefined();
    // Un expediente que nunca uso el flujo offline no se bloquea.
    await expect(t.gate.assertSynced('RECEPCION', 'otro-expediente', scope)).resolves.toBeUndefined();
  });
});
