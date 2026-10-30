import { missingRequiredDocuments } from './required-documents';

describe('missingRequiredDocuments - extranjero (CR-08: pasaporte O carne de extranjeria)', () => {
  const customer = { countryEntryDate: new Date('2026-10-01T00:00:00Z') };
  const base = { driverLicenseValid: true, addressOrStayProofValid: true };

  it('con solo pasaporte validado el set esta completo', () => {
    expect(missingRequiredDocuments('EXTRANJERO', { ...base, passportValid: true }, customer)).toEqual([]);
  });

  it('con solo carne de extranjeria validado el set esta completo', () => {
    expect(missingRequiredDocuments('EXTRANJERO', { ...base, foreignerCardValid: true }, customer)).toEqual([]);
  });

  it('sin pasaporte ni CE faltan ambos', () => {
    const missing = missingRequiredDocuments('EXTRANJERO', base, customer).map((d) => d.code);
    expect(missing).toEqual(['PASAPORTE', 'CARNE_EXTRANJERIA']);
  });

  it('la fecha de ingreso sigue siendo obligatoria', () => {
    const missing = missingRequiredDocuments('EXTRANJERO', { ...base, passportValid: true }, {}).map((d) => d.code);
    expect(missing).toEqual(['FECHA_INGRESO']);
  });

  it('peruano: sin cambios (DNI, licencia y recibo)', () => {
    expect(missingRequiredDocuments('PERUANO', {}, {}).map((d) => d.code)).toEqual(['DNI', 'LICENCIA_CONDUCIR', 'RECIBO_AGUA_LUZ']);
  });
});
