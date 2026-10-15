import { NotFoundException } from '@nestjs/common';
import { RegisterAuthorizedDriverHandler } from './register-authorized-driver.handler';
import { RegisterAuthorizedDriverCommand } from './register-authorized-driver.command';
import { RentalRepositoryPort, RentalRecord } from '../ports/rental-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import { testRole } from '../../../users/testing/role-fixtures';

describe('RegisterAuthorizedDriverHandler (DEC-ALQ-OWN-DRIVER-005, BR-ALQ-015)', () => {
  const fakeTx = {} as any;
  const baseRental: RentalRecord = {
    id: 'rent-1',
    organizationId: 'org-1',
    operatingCompanyId: 'comp-1',
    branchId: 'branch-1',
    inquiryId: null,
    reservationId: null,
    customerId: 'cust-1',
    customerName: 'Titular',
    customerDocNumber: '1',
    vehicleId: 'veh-1',
    vehiclePlate: 'AAA-111',
    vehicleBrand: 'Toyota',
    vehicleModel: 'Yaris',
    vehicleDepositMinimum: null,
    planCode: 'NORMAL',
    status: 'CONTRACTING',
    startAt: new Date(),
    expectedEndAt: new Date(),
    alcoholTestResult: null,
    createdAt: new Date(),
    createdBy: 'u',
    updatedAt: new Date(),
    updatedBy: 'u',
    version: 3,
    parties: [{ id: 'p1', rentalId: 'rent-1', customerId: 'cust-1', role: 'SIGNER', createdAt: new Date() }],
  };

  function build(rental: RentalRecord = baseRental, driverFound = true) {
    const rentals = {
      findById: jest.fn().mockResolvedValue(rental),
      findCustomerById: jest.fn().mockResolvedValue(
        driverFound ? { id: 'cust-9', organizationId: 'org-1', operatingCompanyId: 'comp-1', fullName: 'Chofer', documentNumber: '9', status: 'NORMAL' } : null,
      ),
      addAuthorizedDriver: jest.fn().mockResolvedValue({ ...rental, version: 4 }),
    } as unknown as jest.Mocked<RentalRepositoryPort>;
    const workContext = {
      authorize: jest.fn().mockResolvedValue({ organizationId: 'org-1', companyId: 'comp-1', branchId: 'branch-1', ...testRole('FRONT_OFFICE') }),
    } as unknown as jest.Mocked<WorkContextAuthorizationService>;
    const matrixAuth = { assertAllowed: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<MatrixAuthorizationService>;
    const transactionManager: jest.Mocked<TransactionManagerPort> = { run: jest.fn((work: any) => work(fakeTx)) };
    const audit = { recordRentalEvent: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<AuditEventRepositoryPort>;
    const outbox: jest.Mocked<OutboxEventRepositoryPort> = { publish: jest.fn().mockResolvedValue(undefined) };
    return { rentals, matrixAuth, audit, outbox, handler: new RegisterAuthorizedDriverHandler(rentals, workContext, matrixAuth, transactionManager, audit, outbox) };
  }

  const cmd = (over: { holderType?: 'NATURAL' | 'LEGAL'; addendum?: string; driver?: string } = {}) =>
    new RegisterAuthorizedDriverCommand('rent-1', 'uid-1', 'comp-1', 'branch-1', 3, over.driver ?? 'cust-9', over.addendum ?? 'adenda-001', over.holderType);

  it('persona JURIDICA: registra al conductor con la adenda, audita y publica', async () => {
    const d = build();

    const result = await d.handler.execute(cmd({ holderType: 'LEGAL' }));

    expect(result.version).toBe(4);
    expect(d.matrixAuth.assertAllowed).toHaveBeenCalledWith('org-1', expect.anything(), 'RENTAL', 'FORMALIZE_CONTRACT', expect.anything());
    expect(d.rentals.addAuthorizedDriver).toHaveBeenCalledWith(
      expect.objectContaining({ rentalId: 'rent-1', expectedVersion: 3, customerId: 'cust-9', addendumDocumentRef: 'adenda-001', updatedBy: 'uid-1' }),
      fakeTx,
    );
    expect(d.audit.recordRentalEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'AUTHORIZED_DRIVER_REGISTERED', changes: expect.objectContaining({ holderType: 'LEGAL', addendumDocumentRef: 'adenda-001' }) }),
      fakeTx,
    );
    expect(d.outbox.publish).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'ConductorAutorizadoRegistrado.v1' }), fakeTx);
  });

  it('el tipo de titular sale del contrato formalizado (LEGAL_NO_DRIVER) sin enviar holderType', async () => {
    const d = build({ ...baseRental, status: 'PENDING_DELIVERY', contract: { id: 'c', rentalId: 'rent-1', templateId: null, documentRef: 'd', status: 'SIGNED', signedAt: null, contractVariant: 'LEGAL_NO_DRIVER', createdAt: new Date() } });
    await expect(d.handler.execute(cmd())).resolves.toBeDefined();
  });

  it('persona NATURAL -> 422 NATURAL_PERSON_OWN_DRIVER_NOT_ALLOWED (por holderType o por contrato)', async () => {
    const a = build();
    await expect(a.handler.execute(cmd({ holderType: 'NATURAL' }))).rejects.toMatchObject({ code: 'NATURAL_PERSON_OWN_DRIVER_NOT_ALLOWED', httpStatus: 422 });
    const b = build({ ...baseRental, contract: { id: 'c', rentalId: 'rent-1', templateId: null, documentRef: 'd', status: 'SIGNED', signedAt: null, contractVariant: 'NATURAL_NO_DRIVER', createdAt: new Date() } });
    await expect(b.handler.execute(cmd())).rejects.toMatchObject({ code: 'NATURAL_PERSON_OWN_DRIVER_NOT_ALLOWED' });
    expect(a.rentals.addAuthorizedDriver).not.toHaveBeenCalled();
  });

  it('sin contrato ni holderType -> 422 HOLDER_TYPE_REQUIRED; holderType distinto del contrato -> 422 HOLDER_TYPE_MISMATCH', async () => {
    await expect(build().handler.execute(cmd())).rejects.toMatchObject({ code: 'HOLDER_TYPE_REQUIRED' });
    const withContract = build({ ...baseRental, contract: { id: 'c', rentalId: 'rent-1', templateId: null, documentRef: 'd', status: 'SIGNED', signedAt: null, contractVariant: 'LEGAL_NO_DRIVER', createdAt: new Date() } });
    await expect(withContract.handler.execute(cmd({ holderType: 'NATURAL' }))).rejects.toMatchObject({ code: 'HOLDER_TYPE_MISMATCH' });
  });

  it('exige la adenda (400) y rechaza duplicados (409) y conductor inexistente (422)', async () => {
    await expect(build().handler.execute(cmd({ holderType: 'LEGAL', addendum: '  ' }))).rejects.toMatchObject({ code: 'ADDENDUM_DOCUMENT_REQUIRED' });
    await expect(build().handler.execute(cmd({ holderType: 'LEGAL', driver: 'cust-1' }))).rejects.toMatchObject({ code: 'RENTAL_DRIVER_ALREADY_REGISTERED' });
    await expect(build(baseRental, false).handler.execute(cmd({ holderType: 'LEGAL' }))).rejects.toMatchObject({ response: expect.objectContaining({ code: 'DRIVER_CUSTOMER_NOT_FOUND' }) });
  });

  it('despues de la entrega (ACTIVE) -> 409 RENTAL_DRIVER_REGISTRATION_CLOSED; alquiler inexistente -> 404', async () => {
    await expect(build({ ...baseRental, status: 'ACTIVE' }).handler.execute(cmd({ holderType: 'LEGAL' }))).rejects.toMatchObject({ code: 'RENTAL_DRIVER_REGISTRATION_CLOSED' });
    const d = build();
    d.rentals.findById.mockResolvedValue(null);
    await expect(d.handler.execute(cmd({ holderType: 'LEGAL' }))).rejects.toThrow(NotFoundException);
  });
});
