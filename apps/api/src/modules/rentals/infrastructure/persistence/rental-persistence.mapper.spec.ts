import { toRentalRecord, toRentalExtensionRecord, toRentalPartyRecord, toNotaryEvaluationRecord, toRentalContractRecord, toRentalDepositRecord, RentalWithRelations } from './rental-persistence.mapper';
import { ExtensionStatus } from '../../domain/extension-status';
import { RentalStatus } from '../../domain/rental-status';
import { assertCompanionWithinCapacity } from '../../domain/passenger-capacity';

describe('RentalPersistenceMapper', () => {
  it('correctly maps rental party record', () => {
    const now = new Date();
    const mapped = toRentalPartyRecord({
      id: 'party-1',
      rentalId: 'rental-1',
      customerId: 'cust-1',
      role: 'SIGNER',
      createdAt: now,
    });

    expect(mapped).toEqual({
      id: 'party-1',
      rentalId: 'rental-1',
      customerId: 'cust-1',
      role: 'SIGNER',
      addendumDocumentRef: null,
      createdAt: now,
    });
  });

  it('DEC-ALQ-OWN-DRIVER-005: la party DRIVER conserva la referencia de la adenda', () => {
    const now = new Date();
    const mapped = toRentalPartyRecord({ id: 'p2', rentalId: 'r1', customerId: 'c2', role: 'DRIVER', addendumDocumentRef: 'adenda-77', createdAt: now });
    expect(mapped.addendumDocumentRef).toBe('adenda-77');
  });

  it('DEC-ALQ-COMPANY-DRIVER-004: el contrato por defecto exige garantia y sin saldo a favor', () => {
    const now = new Date();
    const base = { id: 'c', rentalId: 'r', templateId: null, documentRef: 'd', status: 'SIGNED', signedAt: now, createdAt: now };
    expect(toRentalContractRecord(base)).toMatchObject({ depositRequired: true, reservationCreditExcess: '0.00' });
    expect(toRentalContractRecord({ ...base, depositRequired: false, reservationCreditExcess: '300' as any })).toMatchObject({ depositRequired: false, reservationCreditExcess: '300.00' });
  });

  it('correctly maps notary evaluation record', () => {
    const now = new Date();
    const mapped = toNotaryEvaluationRecord({
      id: 'notary-1',
      rentalId: 'rental-1',
      policyVersion: 1,
      result: 'FAVORABLE',
      reason: 'OK',
      evaluatedAt: now,
      approvedBy: 'user-1',
      justification: null,
    });

    expect(mapped?.result).toBe('FAVORABLE');
    expect(toNotaryEvaluationRecord(null)).toBeNull();
  });

  it('correctly maps rental contract and deposit record', () => {
    const now = new Date();
    const contract = toRentalContractRecord({
      id: 'contract-1',
      rentalId: 'rental-1',
      templateId: null,
      documentRef: 'docs/c1.pdf',
      status: 'SIGNED',
      signedAt: now,
      createdAt: now,
    });
    expect(contract?.status).toBe('SIGNED');
    expect(toRentalContractRecord(null)).toBeNull();

    const deposit = toRentalDepositRecord({
      id: 'dep-1',
      rentalId: 'rental-1',
      originalAmount: '500.00' as any,
      currency: 'USD',
      status: 'HELD',
      createdAt: now,
    });
    expect(deposit?.originalAmount).toBe('500.00');
    expect(toRentalDepositRecord(null)).toBeNull();
    // Filas anteriores al traslado reserva -> garantia: sin credito y sin variante.
    expect(deposit?.reservationCreditAmount).toBe('0.00');
    expect(contract?.contractVariant).toBeNull();
  });

  it('P0-03 / BR-DOC-003: mapea el credito de reserva de la garantia y la combinacion del contrato', () => {
    const now = new Date();
    const deposit = toRentalDepositRecord({
      id: 'dep-2',
      rentalId: 'rental-2',
      originalAmount: '1000.00' as any,
      currency: 'PEN',
      status: 'HELD',
      reservationCreditAmount: '300' as any,
      createdAt: now,
    });
    expect(deposit?.reservationCreditAmount).toBe('300.00');

    const contract = toRentalContractRecord({
      id: 'contract-2',
      rentalId: 'rental-2',
      templateId: 'tpl-1',
      documentRef: 'docs/c2.pdf',
      status: 'SIGNED',
      signedAt: now,
      contractVariant: 'LEGAL_WITH_DRIVER',
      createdAt: now,
    });
    expect(contract?.contractVariant).toBe('LEGAL_WITH_DRIVER');
  });

  it('correctly maps rental extension record', () => {
    const now = new Date();
    const mapped = toRentalExtensionRecord({
      id: 'ext-1',
      rentalId: 'rental-1',
      requestedEndAt: now,
      status: 'PENDING',
      paymentId: null,
      addendumDocumentRef: null,
      requestedAt: now,
      resolvedAt: null,
    });

    expect(mapped.status).toBe('PENDING');
    expect(mapped.rentalId).toBe('rental-1');
  });

  it('correctly maps complete RentalWithRelations row to RentalRecord', () => {
    const now = new Date();
    const row = {
      id: 'r-1',
      organizationId: 'org-1',
      operatingCompanyId: 'comp-1',
      branchId: 'branch-1',
      inquiryId: 'inq-1',
      reservationId: 'res-1',
      customerId: 'cust-1',
      vehicleId: 'veh-1',
      planCode: 'NORMAL',
      status: 'ACTIVE',
      startAt: now,
      expectedEndAt: now,
      alcoholTestResult: 'FAVORABLE',
      createdAt: now,
      createdBy: 'user-1',
      updatedAt: now,
      updatedBy: 'user-1',
      version: 1,
      customer: {
        id: 'cust-1',
        organizationId: 'org-1',
        operatingCompanyId: 'comp-1',
        fullName: 'Juan Perez',
        documentNumber: '12345678',
        email: 'juan@test.com',
        phone: '123',
        status: 'NORMAL',
        createdAt: now,
        updatedAt: now,
      },
      vehicle: {
        id: 'veh-1',
        organizationId: 'org-1',
        operatingCompanyId: 'comp-1',
        branchId: 'branch-1',
        plate: 'ABC-123',
        brand: 'Toyota',
        model: 'Corolla',
        year: 2023,
        status: 'RENTED',
        createdAt: now,
        updatedAt: now,
      },
      parties: [],
      notaryEvaluation: null,
      contract: null,
      deposit: null,
    } as unknown as RentalWithRelations;

    const record = toRentalRecord(row);
    expect(record.id).toBe('r-1');
    expect(record.customerName).toBe('Juan Perez');
    expect(record.vehiclePlate).toBe('ABC-123');
    expect(record.status).toBe('ACTIVE');
    expect(record.vehiclePassengerCapacity).toBeNull(); // vehiculo sin capacidad -> el tope no se aplica
  });

  it('mapea vehicle.passengerCapacity a vehiclePassengerCapacity y activa el tope de acompanantes (G-05)', () => {
    const now = new Date();
    const row = {
      id: 'r-2', organizationId: 'org-1', operatingCompanyId: 'comp-1', branchId: 'b-1', inquiryId: null, reservationId: null,
      customerId: 'cust-1', vehicleId: 'veh-1', planCode: 'NORMAL', status: 'ACTIVE', startAt: now, expectedEndAt: now,
      alcoholTestResult: null, createdAt: now, createdBy: 'u', updatedAt: now, updatedBy: 'u', version: 1,
      customer: { fullName: 'Juan Perez', documentNumber: '12345678' },
      vehicle: { plate: 'ABC-123', brand: 'Toyota', model: 'Corolla', depositMinimum: null, passengerCapacity: 4 },
      parties: [], notaryEvaluation: null, contract: null, deposit: null,
    } as unknown as RentalWithRelations;

    const record = toRentalRecord(row);
    expect(record.vehiclePassengerCapacity).toBe(4);
    // 3 acompanantes + 1 nuevo = 4 <= 4: permitido; con 4 actuales se excede.
    expect(() => assertCompanionWithinCapacity(record.vehiclePassengerCapacity, 3)).not.toThrow();
    expect(() => assertCompanionWithinCapacity(record.vehiclePassengerCapacity, 4)).toThrow(
      expect.objectContaining({ code: 'COMPANION_PASSENGER_CAPACITY_EXCEEDED' }),
    );
  });
});
