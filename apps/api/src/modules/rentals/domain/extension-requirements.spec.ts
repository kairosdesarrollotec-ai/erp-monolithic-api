import { evaluateExtensionRequirements } from './extension-requirements';

describe('BR-ALQ-012/013 - requisitos de la ampliacion segun lo registrado', () => {
  const expectedEndAt = new Date('2026-10-10T18:00:00Z');
  const base = { status: 'PENDING' as const, paymentId: null, addendumDocumentRef: null };

  it('aviso con 12 h o mas de anticipacion cuenta como dado', () => {
    const r = evaluateExtensionRequirements(
      { ...base, requestedAt: new Date('2026-10-10T06:00:00Z') },
      expectedEndAt,
    );
    expect(r).toEqual({ noticeGiven: true, authorized: false, paid: false, addendumSigned: false });
  });

  it('aviso con menos de 12 h no cumple', () => {
    const r = evaluateExtensionRequirements(
      { ...base, requestedAt: new Date('2026-10-10T06:00:01Z') },
      expectedEndAt,
    );
    expect(r.noticeGiven).toBe(false);
  });

  it('ampliacion en falta grave (BREACH) sin pago ni adenda: 0 de 4 salvo el aviso', () => {
    const r = evaluateExtensionRequirements(
      { ...base, status: 'BREACH', requestedAt: new Date('2026-10-10T17:00:00Z') },
      expectedEndAt,
    );
    expect(r).toEqual({ noticeGiven: false, authorized: false, paid: false, addendumSigned: false });
  });

  it('ampliacion autorizada con pago y adenda: el aviso ya no se puede reconstruir (null)', () => {
    const r = evaluateExtensionRequirements(
      { status: 'AUTHORIZED', requestedAt: new Date(), paymentId: 'pay-1', addendumDocumentRef: 'adenda-1' },
      expectedEndAt,
    );
    expect(r).toEqual({ noticeGiven: null, authorized: true, paid: true, addendumSigned: true });
  });

  it('sin fecha de vencimiento no se puede evaluar el aviso', () => {
    expect(evaluateExtensionRequirements({ ...base, requestedAt: new Date() }, null).noticeGiven).toBeNull();
  });
});
