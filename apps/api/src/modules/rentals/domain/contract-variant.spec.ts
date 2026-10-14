import {
  CONTRACT_TEMPLATE_TYPE_BY_VARIANT,
  GENERIC_CONTRACT_TEMPLATE_TYPE,
  contractTemplateTypeFor,
  contractVariantCode,
  contractVariantLabel,
  resolveWithCompanyDriver,
} from './contract-variant';
import { TEMPLATE_TYPES } from '../../templates/domain/template-type';

describe('BR-DOC-003 - plantilla por combinacion titular x conductor', () => {
  it('cada una de las 4 combinaciones tiene su propio tipo de plantilla', () => {
    expect(contractTemplateTypeFor({ holderType: 'NATURAL', withCompanyDriver: false })).toBe('RENTAL_CONTRACT_NATURAL');
    expect(contractTemplateTypeFor({ holderType: 'NATURAL', withCompanyDriver: true })).toBe('RENTAL_CONTRACT_NATURAL_DRIVER');
    expect(contractTemplateTypeFor({ holderType: 'LEGAL', withCompanyDriver: false })).toBe('RENTAL_CONTRACT_LEGAL');
    expect(contractTemplateTypeFor({ holderType: 'LEGAL', withCompanyDriver: true })).toBe('RENTAL_CONTRACT_LEGAL_DRIVER');
    expect(new Set(Object.values(CONTRACT_TEMPLATE_TYPE_BY_VARIANT)).size).toBe(4);
  });

  it('todos los tipos de combinacion y el generico son tipos de plantilla validos para crear en Admin', () => {
    for (const type of [...Object.values(CONTRACT_TEMPLATE_TYPE_BY_VARIANT), GENERIC_CONTRACT_TEMPLATE_TYPE]) {
      expect(TEMPLATE_TYPES).toContain(type);
    }
  });

  it('codigo y etiqueta de la combinacion', () => {
    expect(contractVariantCode({ holderType: 'LEGAL', withCompanyDriver: true })).toBe('LEGAL_WITH_DRIVER');
    expect(contractVariantCode({ holderType: 'NATURAL', withCompanyDriver: false })).toBe('NATURAL_NO_DRIVER');
    expect(contractVariantLabel({ holderType: 'LEGAL', withCompanyDriver: false })).toBe('persona juridica, sin conductor de la empresa');
  });
});

describe('resolveWithCompanyDriver (DEC-ALQ-DRIVER-001)', () => {
  it('usa withCompanyDriver y acepta el alias deprecado withDriver', () => {
    expect(resolveWithCompanyDriver({ withCompanyDriver: true })).toBe(true);
    expect(resolveWithCompanyDriver({ withDriver: true })).toBe(true);
    expect(resolveWithCompanyDriver({})).toBeUndefined();
  });

  it('ambos iguales: ok; distintos: 400 CONTRACT_VARIANT_DRIVER_CONFLICT', () => {
    expect(resolveWithCompanyDriver({ withCompanyDriver: false, withDriver: false })).toBe(false);
    let err: any;
    try {
      resolveWithCompanyDriver({ withCompanyDriver: true, withDriver: false });
    } catch (e) {
      err = e;
    }
    expect(err?.getResponse?.()).toEqual(expect.objectContaining({ code: 'CONTRACT_VARIANT_DRIVER_CONFLICT' }));
  });
});
