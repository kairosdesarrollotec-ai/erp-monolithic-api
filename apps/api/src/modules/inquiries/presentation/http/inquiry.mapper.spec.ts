import { toInquiryResponse, toInquirySummaryResponse } from './inquiry.mapper';
import { buildInquiry, buildQuotation } from '../../testing/inquiry-test-fixtures';

describe('inquiry.mapper', () => {
  it('TDD-CON-001 23.1 / SC-CON-001.03: un EXTRANJERO recibe CONSTANCIA_HOSPEDAJE como tercer requisito y su fecha de ingreso', () => {
    const response = toInquirySummaryResponse(
      buildInquiry({ nationality: 'EXTRANJERO', countryEntryDate: new Date('2026-09-01T00:00:00Z') }),
    );

    expect(response.thirdRequiredDocument).toBe('CONSTANCIA_HOSPEDAJE');
    expect(response.countryEntryDate).toBe('2026-09-01');
  });

  it('SC-CON-001.02: un PERUANO recibe RECIBO_AGUA_O_LUZ como tercer requisito', () => {
    expect(toInquirySummaryResponse(buildInquiry({ nationality: 'PERUANO' })).thirdRequiredDocument).toBe('RECIBO_AGUA_O_LUZ');
  });

  it('una consulta LEGACY_STUB expone null (nunca valores inventados) en los datos que nunca se capturaron', () => {
    const response = toInquirySummaryResponse(
      buildInquiry({ dataOrigin: 'LEGACY_STUB', channel: null, nationality: null, destination: null, estimatedDays: null }),
    );

    expect(response).toEqual(
      expect.objectContaining({ dataOrigin: 'LEGACY_STUB', channel: null, nationality: null, thirdRequiredDocument: null, destination: null }),
    );
  });

  it('el resumen (bandeja) no incluye historial; el detalle si', () => {
    const record = buildInquiry({ quotations: [buildQuotation()] });

    expect(toInquirySummaryResponse(record)).not.toHaveProperty('quotations');
    expect(toInquiryResponse(record).quotations).toHaveLength(1);
  });
});
