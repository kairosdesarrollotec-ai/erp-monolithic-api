import { ForbiddenException } from '@nestjs/common';
import { RequestEvidenceDeletionHandler } from './commands/request-evidence-deletion.handler';
import { RequestEvidenceDeletionCommand } from './commands/request-evidence-deletion.command';
import { ApproveEvidenceDeletionHandler } from './commands/approve-evidence-deletion.handler';
import { ApproveEvidenceDeletionCommand } from './commands/approve-evidence-deletion.command';
import { RejectEvidenceDeletionHandler } from './commands/reject-evidence-deletion.handler';
import { RejectEvidenceDeletionCommand } from './commands/reject-evidence-deletion.command';
import { ListEvidenceDeletionRequestsHandler } from './queries/list-evidence-deletion-requests.handler';
import { GetEvidenceDeletionRequestHandler } from './queries/get-evidence-deletion-request.handler';
import { GetEvidenceDeletionRequestQuery, ListEvidenceDeletionRequestsQuery } from './queries/evidence-deletion-queries';
import {
  EvidenceDeletionAlreadyRequestedError,
  EvidenceDeletionInvalidStateError,
  EvidenceDeletionReasonRequiredError,
  EvidenceDeletionRequestExpiredError,
  EvidenceDeletionRequestNotFoundError,
  EvidenceDeletionSameApproverError,
  EvidenceDeletionSelfApprovalError,
} from '../domain/evidence-deletion-errors';
import { BRANCH, COMPANY, FIXED_NOW, buildDeps } from '../testing/evidence-test-fixtures';

function build(now = FIXED_NOW) {
  const d = buildDeps(now);
  return {
    ...d,
    request: new RequestEvidenceDeletionHandler(d.access, d.repo, d.target, d.expiration, d.transactionManager as never, d.clock as never, d.audit as never),
    approve: new ApproveEvidenceDeletionHandler(d.access, d.repo, d.target, d.expiration, d.transactionManager as never, d.clock as never, d.audit as never),
    reject: new RejectEvidenceDeletionHandler(d.access, d.repo, d.expiration, d.transactionManager as never, d.clock as never, d.audit as never),
    list: new ListEvidenceDeletionRequestsHandler(d.access, d.repo, d.clock as never),
    get: new GetEvidenceDeletionRequestHandler(d.access, d.repo, d.clock as never),
  };
}

const requestCmd = (uid = 'u-req', reason = 'Foto subida por error', kind: 'RENTAL' | 'RETURN' = 'RENTAL') =>
  new RequestEvidenceDeletionCommand(uid, COMPANY, BRANCH, kind, 'rent-1', 'ev-1', reason);
const approveCmd = (uid: string, id = 'req-1', note?: string) => new ApproveEvidenceDeletionCommand(uid, COMPANY, BRANCH, id, note);
const rejectCmd = (uid: string, reason = 'No corresponde borrarla', id = 'req-1') => new RejectEvidenceDeletionCommand(uid, COMPANY, BRANCH, id, reason);
const actions = (s: ReturnType<typeof build>) => s.audit.recordEvidenceDeletionEvent.mock.calls.map((c) => (c[0] as { action: string }).action);

describe('Solicitar eliminacion de evidencia (P5 / DEC-EVID-DELETE-002)', () => {
  it('Gerencia o Administracion abren la solicitud PENDING con motivo, foto fija y vigencia de 7 dias; nada se borra; audita', async () => {
    const s = build();
    const created = await s.request.execute(requestCmd());
    expect(created).toMatchObject({ status: 'PENDING', requestedBy: 'u-req', reason: 'Foto subida por error', parentId: 'rent-1', evidenceId: 'ev-1', targetKind: 'RENTAL' });
    expect(created.evidenceSnapshot).toMatchObject({ type: 'PHOTO', zone: 'FRONT' });
    expect(created.expiresAt.toISOString()).toBe('2026-10-28T15:00:00.000Z');
    expect(s.target.remove).not.toHaveBeenCalled();
    expect(actions(s)).toEqual(['EVIDENCE_DELETION_REQUESTED']);
  });

  it('sin EVIDENCE.REQUEST_DELETION (Campo) -> 403 y no consulta ni crea', async () => {
    const s = build();
    await expect(s.request.execute(requestCmd('u-campo'))).rejects.toBeInstanceOf(ForbiddenException);
    expect(s.target.locate).not.toHaveBeenCalled();
    expect(s.repo.create).not.toHaveBeenCalled();
  });

  it('motivo obligatorio: vacio o muy corto -> 400 EVIDENCE_DELETION_REASON_REQUIRED', async () => {
    const s = build();
    const err = await s.request.execute(requestCmd('u-req', '  ')).catch((e) => e);
    expect(err).toBeInstanceOf(EvidenceDeletionReasonRequiredError);
    expect(err.code).toBe('EVIDENCE_DELETION_REASON_REQUIRED');
    expect(err.httpStatus).toBe(400);
    expect(s.repo.create).not.toHaveBeenCalled();
  });

  it('una sola solicitud abierta por evidencia: la segunda -> 409 EVIDENCE_DELETION_ALREADY_REQUESTED', async () => {
    const s = build();
    await s.request.execute(requestCmd());
    const err = await s.request.execute(requestCmd('u-b')).catch((e) => e);
    expect(err).toBeInstanceOf(EvidenceDeletionAlreadyRequestedError);
    expect(err.httpStatus).toBe(409);
  });

  it('si la evidencia ya no es eliminable (el modulo dueño lanza 409/404) no se crea nada', async () => {
    const s = build();
    s.target.locate.mockRejectedValueOnce(new Error('estado'));
    await expect(s.request.execute(requestCmd())).rejects.toThrow('estado');
    expect(s.repo.create).not.toHaveBeenCalled();
  });

  it('una solicitud abierta pero ya VENCIDA no bloquea: se marca EXPIRED y se abre la nueva', async () => {
    const old = build(new Date('2026-10-01T00:00:00Z'));
    await old.request.execute(requestCmd());
    const s = build(FIXED_NOW);
    // misma "base de datos" en memoria
    for (const [k, v] of old.repo.rows) s.repo.rows.set(k, v);
    const created = await s.request.execute(requestCmd('u-b'));
    expect(created.id).not.toBe('req-1');
    expect(s.repo.rows.get('req-1')?.status).toBe('EXPIRED');
    expect(actions(s)).toEqual(['EVIDENCE_DELETION_EXPIRED', 'EVIDENCE_DELETION_REQUESTED']);
  });
});

describe('Aprobar (doble aprobacion): solicitante != 1er aprobador != 2o aprobador', () => {
  it('flujo completo: PENDING -> APPROVED_1 -> EXECUTED; solo la 2a aprobacion borra, dentro de la misma transaccion; audita cada paso', async () => {
    const s = build();
    await s.request.execute(requestCmd());

    const first = await s.approve.execute(approveCmd('u-a', 'req-1', 'ok'));
    expect(first).toMatchObject({ status: 'APPROVED_1', firstApprovedBy: 'u-a', firstApprovalNote: 'ok', version: 2 });
    expect(s.target.remove).not.toHaveBeenCalled();

    const second = await s.approve.execute(approveCmd('u-admin'));
    expect(second).toMatchObject({ status: 'EXECUTED', secondApprovedBy: 'u-admin', executedAt: FIXED_NOW });
    expect(s.target.remove).toHaveBeenCalledTimes(1);
    expect(s.target.remove).toHaveBeenCalledWith('RENTAL', 'rent-1', 'ev-1', { organizationId: 'org-1', operatingCompanyId: COMPANY, branchId: BRANCH }, s.tx);
    expect(actions(s)).toEqual([
      'EVIDENCE_DELETION_REQUESTED',
      'EVIDENCE_DELETION_APPROVED_1',
      'EVIDENCE_DELETION_APPROVED_2',
      'EVIDENCE_DELETION_EXECUTED',
    ]);
    const executed = s.audit.recordEvidenceDeletionEvent.mock.calls.find((c) => (c[0] as { action: string }).action === 'EVIDENCE_DELETION_EXECUTED')![0] as { changes: Record<string, unknown> };
    expect(executed.changes).toMatchObject({ requestedBy: 'u-req', firstApprovedBy: 'u-a', secondApprovedBy: 'u-admin', reason: 'Foto subida por error' });
  });

  it('el solicitante NO puede aprobar su propia solicitud -> 403 EVIDENCE_DELETION_SELF_APPROVAL', async () => {
    const s = build();
    await s.request.execute(requestCmd());
    const err = await s.approve.execute(approveCmd('u-req')).catch((e) => e);
    expect(err).toBeInstanceOf(EvidenceDeletionSelfApprovalError);
    expect(err.code).toBe('EVIDENCE_DELETION_SELF_APPROVAL');
    expect(err.httpStatus).toBe(403);
    expect(s.repo.rows.get('req-1')?.status).toBe('PENDING');
  });

  it('el 2o aprobador no puede ser el 1o -> 403 EVIDENCE_DELETION_SAME_APPROVER y no se borra', async () => {
    const s = build();
    await s.request.execute(requestCmd());
    await s.approve.execute(approveCmd('u-a'));
    const err = await s.approve.execute(approveCmd('u-a')).catch((e) => e);
    expect(err).toBeInstanceOf(EvidenceDeletionSameApproverError);
    expect(s.target.remove).not.toHaveBeenCalled();
    expect(s.repo.rows.get('req-1')?.status).toBe('APPROVED_1');
  });

  it('el solicitante tampoco puede dar la 2a aprobacion', async () => {
    const s = build();
    await s.request.execute(requestCmd());
    await s.approve.execute(approveCmd('u-a'));
    await expect(s.approve.execute(approveCmd('u-req'))).rejects.toBeInstanceOf(EvidenceDeletionSelfApprovalError);
    expect(s.target.remove).not.toHaveBeenCalled();
  });

  it('sin EVIDENCE.APPROVE_DELETION -> 403', async () => {
    const s = build();
    await s.request.execute(requestCmd());
    await expect(s.approve.execute(approveCmd('u-campo'))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('solicitud inexistente o de otra empresa -> 404', async () => {
    const s = build();
    await expect(s.approve.execute(approveCmd('u-a', 'nope'))).rejects.toBeInstanceOf(EvidenceDeletionRequestNotFoundError);
  });

  it('carrera: dos aprobadores leen PENDING a la vez; el segundo UPDATE pierde la guarda y recibe 409 (no se salta la doble aprobacion)', async () => {
    const s = build();
    await s.request.execute(requestCmd());
    const realFind = s.repo.findById.getMockImplementation()!;
    // Ambos handlers leen la version 1 antes de que cualquiera escriba.
    const snapshot = { ...s.repo.rows.get('req-1')! };
    s.repo.findById.mockImplementation(async (id: string, o: string, c: string) => (id === 'req-1' ? { ...snapshot } : realFind(id, o, c)));
    const [a, b] = await Promise.allSettled([s.approve.execute(approveCmd('u-a')), s.approve.execute(approveCmd('u-b'))]);
    expect([a.status, b.status].sort()).toEqual(['fulfilled', 'rejected']);
    const rejected = (a.status === 'rejected' ? a : b) as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(EvidenceDeletionInvalidStateError);
    expect(s.repo.rows.get('req-1')).toMatchObject({ status: 'APPROVED_1', version: 2 });
    expect(s.target.remove).not.toHaveBeenCalled();
  });

  it('si el borrado falla al ejecutar (el expediente ya no lo admite) la transaccion se revierte: la solicitud sigue APPROVED_1 en el repositorio real; aqui el error se propaga', async () => {
    const s = build();
    await s.request.execute(requestCmd());
    await s.approve.execute(approveCmd('u-a'));
    s.target.remove.mockRejectedValueOnce(new Error('RENTAL_STATE_CONFLICT'));
    await expect(s.approve.execute(approveCmd('u-b'))).rejects.toThrow('RENTAL_STATE_CONFLICT');
    // la auditoria de los pasos 2/ejecutado NO se escribio (el fallo ocurre antes de auditar)
    expect(actions(s)).not.toContain('EVIDENCE_DELETION_EXECUTED');
  });

  it('solicitud vencida: se marca EXPIRED y responde 409 EVIDENCE_DELETION_REQUEST_EXPIRED', async () => {
    const old = build(new Date('2026-10-01T00:00:00Z'));
    await old.request.execute(requestCmd());
    const s = build(FIXED_NOW);
    for (const [k, v] of old.repo.rows) s.repo.rows.set(k, v);
    const err = await s.approve.execute(approveCmd('u-a')).catch((e) => e);
    expect(err).toBeInstanceOf(EvidenceDeletionRequestExpiredError);
    expect(s.repo.rows.get('req-1')?.status).toBe('EXPIRED');
    expect(actions(s)).toEqual(['EVIDENCE_DELETION_EXPIRED']);
    expect(s.target.remove).not.toHaveBeenCalled();
  });

  it('una solicitud ya EXECUTED no admite otra aprobacion (409 EVIDENCE_DELETION_INVALID_STATE)', async () => {
    const s = build();
    await s.request.execute(requestCmd());
    await s.approve.execute(approveCmd('u-a'));
    await s.approve.execute(approveCmd('u-b'));
    const err = await s.approve.execute(approveCmd('u-admin')).catch((e) => e);
    expect(err).toBeInstanceOf(EvidenceDeletionInvalidStateError);
    expect(err.code).toBe('EVIDENCE_DELETION_INVALID_STATE');
    expect(s.target.remove).toHaveBeenCalledTimes(1);
  });
});

describe('Rechazar', () => {
  it('otra persona rechaza con motivo -> REJECTED, la evidencia no se toca, audita', async () => {
    const s = build();
    await s.request.execute(requestCmd());
    const rejected = await s.reject.execute(rejectCmd('u-a'));
    expect(rejected).toMatchObject({ status: 'REJECTED', rejectedBy: 'u-a', rejectionReason: 'No corresponde borrarla' });
    expect(s.target.remove).not.toHaveBeenCalled();
    expect(actions(s)).toEqual(['EVIDENCE_DELETION_REQUESTED', 'EVIDENCE_DELETION_REJECTED']);
  });

  it('tambien se puede rechazar tras la 1a aprobacion; el motivo es obligatorio; el solicitante no rechaza', async () => {
    const s = build();
    await s.request.execute(requestCmd());
    await s.approve.execute(approveCmd('u-a'));
    await expect(s.reject.execute(rejectCmd('u-b', ' '))).rejects.toBeInstanceOf(EvidenceDeletionReasonRequiredError);
    await expect(s.reject.execute(rejectCmd('u-req'))).rejects.toBeInstanceOf(EvidenceDeletionSelfApprovalError);
    await expect(s.reject.execute(rejectCmd('u-b'))).resolves.toMatchObject({ status: 'REJECTED' });
    // tras rechazar se puede abrir una solicitud nueva sobre la misma evidencia
    await expect(s.request.execute(requestCmd('u-b'))).resolves.toMatchObject({ status: 'PENDING' });
  });

  it('sin EVIDENCE.APPROVE_DELETION -> 403', async () => {
    const s = build();
    await s.request.execute(requestCmd());
    await expect(s.reject.execute(rejectCmd('u-campo'))).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('Consultas y vencimiento', () => {
  it('lista y detalle exigen poder solicitar o aprobar (Campo -> 403) e informan al usuario que puede hacer', async () => {
    const s = build();
    await s.request.execute(requestCmd());
    await expect(s.list.execute(new ListEvidenceDeletionRequestsQuery('u-campo', COMPANY, BRANCH))).rejects.toBeInstanceOf(ForbiddenException);
    const asRequester = await s.get.execute(new GetEvidenceDeletionRequestQuery('u-req', COMPANY, BRANCH, 'req-1'));
    expect(asRequester.viewer).toEqual({ canApprove: false, canReject: false });
    const asOther = await s.list.execute(new ListEvidenceDeletionRequestsQuery('u-a', COMPANY, BRANCH));
    expect(asOther).toHaveLength(1);
    expect(asOther[0].viewer).toEqual({ canApprove: true, canReject: true });
    await expect(s.get.execute(new GetEvidenceDeletionRequestQuery('u-a', COMPANY, BRANCH, 'nope'))).rejects.toBeInstanceOf(EvidenceDeletionRequestNotFoundError);
  });

  it('una solicitud abierta vencida se ve EXPIRED aunque el job no la haya marcado', async () => {
    const old = build(new Date('2026-10-01T00:00:00Z'));
    await old.request.execute(requestCmd());
    const s = build(FIXED_NOW);
    for (const [k, v] of old.repo.rows) s.repo.rows.set(k, v);
    const view = await s.get.execute(new GetEvidenceDeletionRequestQuery('u-a', COMPANY, BRANCH, 'req-1'));
    expect(view.request.status).toBe('EXPIRED');
    expect(view.viewer.canApprove).toBe(false);
  });

  it('el job vence las abiertas con vigencia pasada, audita con actor sistema y es idempotente', async () => {
    const old = build(new Date('2026-10-01T00:00:00Z'));
    await old.request.execute(requestCmd());
    const s = build(FIXED_NOW);
    for (const [k, v] of old.repo.rows) s.repo.rows.set(k, v);
    expect(await s.expiration.expireDue(FIXED_NOW)).toBe(1);
    expect(s.repo.rows.get('req-1')).toMatchObject({ status: 'EXPIRED', expiredAt: FIXED_NOW });
    expect(s.audit.recordEvidenceDeletionEvent).toHaveBeenCalledWith(expect.objectContaining({ actorUserId: null, action: 'EVIDENCE_DELETION_EXPIRED' }), s.tx);
    expect(await s.expiration.expireDue(FIXED_NOW)).toBe(0);
  });
});
