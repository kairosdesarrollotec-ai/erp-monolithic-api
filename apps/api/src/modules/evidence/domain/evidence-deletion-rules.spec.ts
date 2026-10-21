import {
  assertCanApprove,
  assertCanReject,
  canActorApprove,
  computeEvidenceDeletionExpiry,
  effectiveDeletionStatus,
  evidenceDeletionTtlDays,
  normalizeDeletionReason,
} from './evidence-deletion-rules';
import {
  EvidenceDeletionInvalidStateError,
  EvidenceDeletionReasonRequiredError,
  EvidenceDeletionSameApproverError,
  EvidenceDeletionSelfApprovalError,
} from './evidence-deletion-errors';

const NOW = new Date('2026-10-21T15:00:00Z');
const req = (over: Record<string, unknown> = {}) => ({
  status: 'PENDING' as const,
  requestedBy: 'u-req',
  firstApprovedBy: null as string | null,
  expiresAt: new Date('2026-10-28T15:00:00Z'),
  ...over,
});

describe('doble aprobacion para eliminar evidencia: reglas de dominio (SDD 15.5 / DEC-EVID-DELETE-002)', () => {
  it('el solicitante NO puede aprobar (ni la 1a ni la 2a)', () => {
    expect(() => assertCanApprove(req(), 'u-req')).toThrow(EvidenceDeletionSelfApprovalError);
    expect(() => assertCanApprove(req({ status: 'APPROVED_1', firstApprovedBy: 'u-a' }), 'u-req')).toThrow(EvidenceDeletionSelfApprovalError);
  });

  it('la 1a aprobacion la da otra persona (paso FIRST); la 2a (SECOND) debe ser distinta del solicitante Y del primero', () => {
    expect(assertCanApprove(req(), 'u-a')).toBe('FIRST');
    const open = req({ status: 'APPROVED_1', firstApprovedBy: 'u-a' });
    expect(() => assertCanApprove(open, 'u-a')).toThrow(EvidenceDeletionSameApproverError);
    expect(assertCanApprove(open, 'u-b')).toBe('SECOND');
  });

  it.each(['EXECUTED', 'REJECTED', 'EXPIRED'] as const)('una solicitud %s ya no admite aprobar ni rechazar', (status) => {
    expect(() => assertCanApprove(req({ status }), 'u-a')).toThrow(EvidenceDeletionInvalidStateError);
    expect(() => assertCanReject(req({ status }), 'u-a')).toThrow(EvidenceDeletionInvalidStateError);
  });

  it('rechazar: otra persona distinta del solicitante, en PENDING o APPROVED_1 (tambien el primer aprobador)', () => {
    expect(() => assertCanReject(req(), 'u-req')).toThrow(EvidenceDeletionSelfApprovalError);
    expect(() => assertCanReject(req(), 'u-a')).not.toThrow();
    expect(() => assertCanReject(req({ status: 'APPROVED_1', firstApprovedBy: 'u-a' }), 'u-a')).not.toThrow();
  });

  it('el motivo es obligatorio (recortado, minimo 5 caracteres)', () => {
    expect(() => normalizeDeletionReason('   ')).toThrow(EvidenceDeletionReasonRequiredError);
    expect(() => normalizeDeletionReason('abc')).toThrow(EvidenceDeletionReasonRequiredError);
    expect(() => normalizeDeletionReason(undefined)).toThrow(EvidenceDeletionReasonRequiredError);
    expect(normalizeDeletionReason('  foto duplicada  ')).toBe('foto duplicada');
  });

  it('vigencia: 7 dias por defecto, configurable por EVIDENCE_DELETION_TTL_DAYS (invalido -> 7)', () => {
    expect(evidenceDeletionTtlDays(undefined)).toBe(7);
    expect(evidenceDeletionTtlDays('3')).toBe(3);
    expect(evidenceDeletionTtlDays('abc')).toBe(7);
    expect(evidenceDeletionTtlDays('0')).toBe(7);
    expect(computeEvidenceDeletionExpiry(NOW, 7).toISOString()).toBe('2026-10-28T15:00:00.000Z');
  });

  it('estado efectivo: abierta + vigencia vencida = EXPIRED; terminales no cambian', () => {
    expect(effectiveDeletionStatus(req(), NOW)).toBe('PENDING');
    expect(effectiveDeletionStatus(req({ expiresAt: NOW }), NOW)).toBe('EXPIRED');
    expect(effectiveDeletionStatus(req({ status: 'APPROVED_1', expiresAt: new Date('2026-10-01T00:00:00Z') }), NOW)).toBe('EXPIRED');
    expect(effectiveDeletionStatus(req({ status: 'EXECUTED', expiresAt: new Date('2026-10-01T00:00:00Z') }), NOW)).toBe('EXECUTED');
  });

  it('canActorApprove (para la UI) respeta las mismas reglas y la vigencia', () => {
    expect(canActorApprove(req(), 'u-req', NOW)).toBe(false);
    expect(canActorApprove(req(), 'u-a', NOW)).toBe(true);
    expect(canActorApprove(req({ status: 'APPROVED_1', firstApprovedBy: 'u-a' }), 'u-a', NOW)).toBe(false);
    expect(canActorApprove(req({ expiresAt: NOW }), 'u-a', NOW)).toBe(false);
  });
});
