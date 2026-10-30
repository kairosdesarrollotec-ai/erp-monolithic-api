import { assertValidIdentityDocument, assertValidPhone } from './identity-document';

describe('identity-document (CR-10 / R-7)', () => {
  it.each([
    ['DNI', '12345678'],
    ['dni', '70889900'],
    ['RUC', '20123456789'],
    ['CE', '001234567'],
    ['PASAPORTE', 'AB123456'],
    ['OTRO', 'cualquier-cosa'],
  ])('acepta %s %s', (type, number) => {
    expect(() => assertValidIdentityDocument(type, number)).not.toThrow();
  });

  it.each([
    ['DNI', '123'],
    ['DNI', 'ABCDEFGH'],
    ['DNI', '1234567890'],
    ['RUC', '2012345678'],
    ['CE', '12'],
    ['PASAPORTE', '1'],
  ])('rechaza %s %s con INVALID_DOCUMENT_NUMBER', (type, number) => {
    expect(() => assertValidIdentityDocument(type, number)).toThrow(expect.objectContaining({ code: 'INVALID_DOCUMENT_NUMBER' }));
  });

  it('telefono: acepta digitos con +, espacios y guiones; vacio/null pasan', () => {
    expect(() => assertValidPhone('+51 987-654-321')).not.toThrow();
    expect(() => assertValidPhone('987654321')).not.toThrow();
    expect(() => assertValidPhone(undefined)).not.toThrow();
    expect(() => assertValidPhone('')).not.toThrow();
  });

  it.each(['abc', '12ab34', '123', '1234567890123456'])('telefono invalido %s -> INVALID_PHONE_NUMBER', (phone) => {
    expect(() => assertValidPhone(phone)).toThrow(expect.objectContaining({ code: 'INVALID_PHONE_NUMBER' }));
  });
});
