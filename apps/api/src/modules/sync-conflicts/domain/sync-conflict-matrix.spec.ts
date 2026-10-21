import { classifyIncomingFields, policyFor, SYNC_CONFLICT_MATRIX, type IncomingField } from './sync-conflict-matrix';
import { SyncPaymentOnlineOnlyError, SyncResolverNotSupportedError } from './sync-errors';

const field = (over: Partial<IncomingField>): IncomingField => ({
  key: 'fuel',
  dataType: 'CHECKLIST',
  value: 'FULL',
  baseRev: 0,
  editedAt: '2026-10-19T14:00:00.000Z',
  ...over,
});

describe('matriz de conflicto por tipo de dato (SDD 17.4)', () => {
  it('disponibilidad, reserva y estado del vehiculo: prevalece el servidor, sin override manual', () => {
    for (const t of ['AVAILABILITY', 'RESERVATION', 'VEHICLE_STATE'] as const) {
      expect(policyFor(t)).toEqual({ strategy: 'SERVER_WINS', resolver: 'NONE', manualOverrideAllowed: false });
    }
  });

  it('checklist: merge por campo y resuelve un supervisor; evidencias: aditivas', () => {
    expect(SYNC_CONFLICT_MATRIX.CHECKLIST).toMatchObject({ strategy: 'FIELD_MERGE', resolver: 'SUPERVISOR' });
    expect(SYNC_CONFLICT_MATRIX.EVIDENCE.strategy).toBe('ADDITIVE');
  });

  it('descarta (sin conflicto) lo que el servidor siempre gana y deja pasar el checklist', () => {
    const { checklist, discarded } = classifyIncomingFields([
      field({ key: 'fuel' }),
      field({ key: 'vehicleStatus', dataType: 'VEHICLE_STATE' }),
      field({ key: 'slot', dataType: 'AVAILABILITY' }),
    ]);
    expect(checklist.map((f) => f.key)).toEqual(['fuel']);
    expect(discarded.map((d) => [d.key, d.code])).toEqual([
      ['vehicleStatus', 'SERVER_PREVAILS'],
      ['slot', 'SERVER_PREVAILS'],
    ]);
  });

  it('el pago es solo online: rechaza todo el lote con SYNC_PAYMENT_ONLINE_ONLY', () => {
    expect(() => classifyIncomingFields([field({}), field({ key: 'amount', dataType: 'PAYMENT' })])).toThrow(SyncPaymentOnlineOnlyError);
  });

  it('datos de empleados (RR.HH.) y borrados criticos (Data Owner) no se resuelven aqui', () => {
    expect(() => classifyIncomingFields([field({ dataType: 'EMPLOYEE' })])).toThrow(SyncResolverNotSupportedError);
    expect(() => classifyIncomingFields([field({ dataType: 'CRITICAL_DELETE' })])).toThrow(SyncResolverNotSupportedError);
  });
});
