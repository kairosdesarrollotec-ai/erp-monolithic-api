import { toCustomerResponse } from './customer.mapper';
import { Customer } from '../../domain/customer';

describe('toCustomerResponse', () => {
  it('mapea correctamente entidad Customer a CustomerResponse', () => {
    const customer: Customer = {
      id: 'c1',
      organizationId: 'org1',
      operatingCompanyId: 'comp1',
      fullName: 'Juan Perez',
      documentType: 'DNI',
      documentNumber: '12345678',
      nationality: 'PERUANO',
      countryEntryDate: null,
      email: 'juan@test.com',
      phone: '999888777',
      address: 'Calle Real 100',
      createdAt: new Date('2026-09-28T12:00:00.000Z'),
      updatedAt: new Date('2026-09-28T12:00:00.000Z'),
    };

    const res = toCustomerResponse(customer);

    expect(res).toEqual({
      id: 'c1',
      organizationId: 'org1',
      operatingCompanyId: 'comp1',
      fullName: 'Juan Perez',
      documentType: 'DNI',
      documentNumber: '12345678',
      nationality: 'PERUANO',
      countryEntryDate: null,
      email: 'juan@test.com',
      phone: '999888777',
      address: 'Calle Real 100',
      riskStatus: 'NORMAL',
      riskReason: null,
      createdAt: '2026-09-28T12:00:00.000Z',
      updatedAt: '2026-09-28T12:00:00.000Z',
    });
  });

  it('formatea countryEntryDate en formato YYYY-MM-DD cuando existe', () => {
    const customer: Customer = {
      id: 'c2',
      organizationId: 'org1',
      operatingCompanyId: 'comp1',
      fullName: 'Alice Walker',
      documentType: 'PASAPORTE',
      documentNumber: 'P123456',
      nationality: 'EXTRANJERO',
      countryEntryDate: new Date('2026-09-15T00:00:00.000Z'),
      email: null,
      phone: null,
      address: null,
      createdAt: new Date('2026-09-28T12:00:00.000Z'),
      updatedAt: new Date('2026-09-28T12:00:00.000Z'),
    };

    const res = toCustomerResponse(customer);

    expect(res.countryEntryDate).toBe('2026-09-15');
    expect(res.email).toBeNull();
    expect(res.phone).toBeNull();
    expect(res.address).toBeNull();
  });
});

describe('toCustomerResponse riskStatus (H-17)', () => {
  it('expone el semáforo del cliente y asume NORMAL cuando no viene', () => {
    const base = {
      id: 'c3',
      organizationId: 'org1',
      operatingCompanyId: 'comp1',
      fullName: 'Ana',
      documentType: 'DNI',
      documentNumber: '1',
      createdAt: new Date('2026-09-28T12:00:00.000Z'),
      updatedAt: new Date('2026-09-28T12:00:00.000Z'),
    };
    expect(toCustomerResponse({ ...base, riskStatus: 'ROJO' }).riskStatus).toBe('ROJO');
    expect(toCustomerResponse(base).riskStatus).toBe('NORMAL');
  });
});
