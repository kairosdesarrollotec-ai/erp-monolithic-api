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

  it('P-03: requiredDocuments segun nacionalidad del cliente (peruano: agua/luz; extranjero: hospedaje; sin dato: vacio)', () => {
    expect(toInquiryResponse(buildInquiry({ customerNationality: 'PERUANO' })).requiredDocuments).toEqual([
      { code: 'RECIBO_AGUA_O_LUZ', label: 'Recibo de agua o luz' },
    ]);
    expect(toInquiryResponse(buildInquiry({ customerNationality: 'EXTRANJERO' })).requiredDocuments).toEqual([
      { code: 'CONSTANCIA_HOSPEDAJE', label: 'Constancia de hospedaje' },
    ]);
    expect(toInquiryResponse(buildInquiry({ customerNationality: null })).requiredDocuments).toEqual([]);
  });

  it('P-06: latestQuotationId apunta a la cotizacion mas reciente (el repositorio entrega quotations DESC: indice 0)', () => {
    const newer = buildQuotation({ id: 'quo-new', createdAt: new Date('2026-09-24T10:00:00Z') });
    const older = buildQuotation({ id: 'quo-old', createdAt: new Date('2026-09-23T10:00:00Z') });
    const response = toInquiryResponse(buildInquiry({ quotations: [newer, older] }));

    expect(response.latestQuotationId).toBe('quo-new');
    expect(response.quotations[0].id).toBe('quo-new');
    expect(toInquiryResponse(buildInquiry()).latestQuotationId).toBeNull();
  });
});
