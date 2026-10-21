import { holderTypeFromDocumentType } from './contract-variant';
import { computeCompanyDriverCharge, rentalBillableDays } from './company-driver-charge';
import { assertCompanionWithinCapacity } from './passenger-capacity';
import { resolveRentalHolderType } from './holder-type-resolution';

describe('reglas de negocio de Fiorella (16-oct-2026)', () => {
  it('tipo de titular por tipo de documento: RUC -> LEGAL, DNI -> NATURAL, otros -> null', () => {
    expect(holderTypeFromDocumentType('ruc')).toBe('LEGAL');
    expect(holderTypeFromDocumentType('DNI')).toBe('NATURAL');
    expect(holderTypeFromDocumentType('CE')).toBeNull();
    expect(holderTypeFromDocumentType(undefined)).toBeNull();
  });

  it('resolveRentalHolderType: contrato > documento > request; conflicto -> HOLDER_TYPE_MISMATCH', () => {
    expect(resolveRentalHolderType({ contractVariant: 'LEGAL_NO_DRIVER', titularDocumentType: 'DNI', requested: undefined })).toBe('LEGAL');
    expect(resolveRentalHolderType({ contractVariant: null, titularDocumentType: 'RUC', requested: 'LEGAL' })).toBe('LEGAL');
    expect(resolveRentalHolderType({ contractVariant: null, titularDocumentType: 'CE', requested: 'NATURAL' })).toBe('NATURAL');
    expect(() => resolveRentalHolderType({ contractVariant: null, titularDocumentType: 'RUC', requested: 'NATURAL' })).toThrow(/no coincide/);
    expect(() => resolveRentalHolderType({ contractVariant: null, titularDocumentType: null, requested: undefined })).toThrow(/holderType/);
  });

  it('capacidad: sin dato no valida; con dato el maximo de acompanantes es la capacidad', () => {
    expect(() => assertCompanionWithinCapacity(null, 9)).not.toThrow();
    expect(() => assertCompanionWithinCapacity(undefined, 9)).not.toThrow();
    expect(() => assertCompanionWithinCapacity(2, 1)).not.toThrow();
    expect(() => assertCompanionWithinCapacity(2, 2)).toThrow(/maximo 2/);
  });

  it('cargo del conductor de la empresa: tarifa diaria x dias, sin tarifa -> configured=false', () => {
    const start = new Date('2026-10-01T10:00:00Z');
    expect(rentalBillableDays(start, new Date('2026-10-04T10:00:00Z'))).toBe(3);
    expect(rentalBillableDays(start, new Date('2026-10-04T11:00:00Z'))).toBe(4);
    expect(rentalBillableDays(start, start)).toBe(1);
    expect(rentalBillableDays(null, start)).toBe(0);
    expect(computeCompanyDriverCharge({ dailyRate: '80', currency: 'PEN', startAt: start, expectedEndAt: new Date('2026-10-04T10:00:00Z') }))
      .toEqual({ configured: true, dailyRate: '80.00', currency: 'PEN', days: 3, total: '240.00' });
    expect(computeCompanyDriverCharge({ dailyRate: undefined, startAt: start, expectedEndAt: new Date('2026-10-04T10:00:00Z') }))
      .toEqual({ configured: false, dailyRate: '0.00', currency: 'PEN', days: 3, total: '0.00' });
    expect(computeCompanyDriverCharge({ dailyRate: 'abc', startAt: start, expectedEndAt: start }).configured).toBe(false);
  });
});
