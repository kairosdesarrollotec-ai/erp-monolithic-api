import { toRentalRecord, toRentalExtensionRecord, toRentalPartyRecord, toNotaryEvaluationRecord, toRentalContractRecord, toRentalDepositRecord, RentalWithRelations } from './rental-persistence.mapper';
import { ExtensionStatus } from '../../domain/extension-status';
import { RentalStatus } from '../../domain/rental-status';

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
      createdAt: now,
    });
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
      templateVersionId: 'tpl-1',
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
  });
});
