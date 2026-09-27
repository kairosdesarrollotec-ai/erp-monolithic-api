import { toInquiryResponse, toInquirySummaryResponse } from './inquiry.mapper';
import { buildInquiry, buildQuotation } from '../../testing/inquiry-test-fixtures';

describe('inquiry.mapper', () => {
  it('expone el contexto del viaje en el resumen (CONFLICT-CON-002: identidad del prospecto en Customer, no en Inquiry)', () => {
    const response = toInquirySummaryResponse(
      buildInquiry({ destination: 'Vilcashuaman', estimatedDays: 3, partySize: 4 }),
    );

    expect(response.destination).toBe('Vilcashuaman');
    expect(response.estimatedDays).toBe(3);
    expect(response.partySize).toBe(4);
  });

  it('una consulta LEGACY_STUB expone null en los datos que nunca se capturaron', () => {
    const response = toInquirySummaryResponse(
      buildInquiry({ dataOrigin: 'LEGACY_STUB', channel: null, destination: null, estimatedDays: null }),
    );

    expect(response).toEqual(
      expect.objectContaining({ dataOrigin: 'LEGACY_STUB', channel: null, destination: null }),
    );
  });

  it('el resumen (bandeja) no incluye historial; el detalle si', () => {
    const record = buildInquiry({ quotations: [buildQuotation()] });

    expect(toInquirySummaryResponse(record)).not.toHaveProperty('quotations');
    expect(toInquiryResponse(record).quotations).toHaveLength(1);
  });
});
