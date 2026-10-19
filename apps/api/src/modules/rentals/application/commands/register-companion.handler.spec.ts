import { NotFoundException } from '@nestjs/common';
import { RegisterCompanionHandler } from './register-companion.handler';
import { RegisterCompanionCommand } from './register-companion.command';
import { RentalRepositoryPort, RentalRecord } from '../ports/rental-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import { testRole } from '../../../users/testing/role-fixtures';

describe('RegisterCompanionHandler (DEC-ALQ-COMPANION-006, BR-ALQ-015)', () => {
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

  function build(rental: RentalRecord = baseRental, companionFound = true, titularDocType = 'DNI') {
    const customer = (id: string, documentType = 'DNI') => ({ id, organizationId: 'org-1', operatingCompanyId: 'comp-1', fullName: id, documentNumber: '9', documentType, status: 'NORMAL' });
    const rentals = {
      findById: jest.fn().mockResolvedValue(rental),
      findCustomerById: jest.fn().mockImplementation(async (id: string) => {
        if (id === 'cust-1') return customer('cust-1', titularDocType);
        if (id === 'cust-9') return companionFound ? customer('cust-9') : null;
        if (id === 'cust-8') return customer('cust-8');
        return null;
      }),
      addAuthorizedDriver: jest.fn().mockResolvedValueOnce({ ...rental, version: 4 }).mockResolvedValueOnce({ ...rental, version: 5 }),
    } as unknown as jest.Mocked<RentalRepositoryPort>;
    const workContext = {
      authorize: jest.fn().mockResolvedValue({ organizationId: 'org-1', companyId: 'comp-1', branchId: 'branch-1', ...testRole('FRONT_OFFICE') }),
    } as unknown as jest.Mocked<WorkContextAuthorizationService>;
    const matrixAuth = { assertAllowed: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<MatrixAuthorizationService>;
    const transactionManager: jest.Mocked<TransactionManagerPort> = { run: jest.fn((work: any) => work(fakeTx)) };
    const audit = { recordRentalEvent: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<AuditEventRepositoryPort>;
    const outbox: jest.Mocked<OutboxEventRepositoryPort> = { publish: jest.fn().mockResolvedValue(undefined) };
    return { rentals, matrixAuth, audit, outbox, handler: new RegisterCompanionHandler(rentals, workContext, matrixAuth, transactionManager, audit, outbox) };
  }

  const cmd = (
    over: { holderType?: 'NATURAL' | 'LEGAL'; reason?: string; addendum?: string; companion?: string; driver?: string; companionLic?: boolean; driverLic?: boolean } = {},
  ) =>
    new RegisterCompanionCommand(
      'rent-1', 'uid-1', 'comp-1', 'branch-1', 3,
      over.companion ?? 'cust-9', over.driver ?? 'cust-8', over.companionLic ?? true, over.driverLic ?? true,
      over.reason ?? 'Brevete extranjero no valido en Peru', over.addendum, over.holderType,
    );

  const naturalContract = { id: 'c', rentalId: 'rent-1', templateId: null, documentRef: 'd', status: 'SIGNED', signedAt: null, contractVariant: 'NATURAL_NO_DRIVER', createdAt: new Date() } as any;

  it('persona NATURAL: registra al acompanante como RESPONSIBLE, audita con el motivo y publica', async () => {
    const d = build();

    const result = await d.handler.execute(cmd({ holderType: 'NATURAL', addendum: ' doc-77 ' }));

    expect(result.version).toBe(5);
    expect(d.matrixAuth.assertAllowed).toHaveBeenCalledWith('org-1', expect.anything(), 'RENTAL', 'FORMALIZE_CONTRACT', expect.anything());
    expect(d.rentals.addAuthorizedDriver).toHaveBeenCalledWith(
      expect.objectContaining({ rentalId: 'rent-1', expectedVersion: 3, customerId: 'cust-9', role: 'RESPONSIBLE', addendumDocumentRef: 'doc-77', updatedBy: 'uid-1' }),
      fakeTx,
    );
    // conductor real: segunda party DRIVER con la version nueva y sin adenda
    expect(d.rentals.addAuthorizedDriver).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ customerId: 'cust-8', role: 'DRIVER', expectedVersion: 4, addendumDocumentRef: null }),
      fakeTx,
    );
    expect(d.audit.recordRentalEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'COMPANION_REGISTERED',
        changes: expect.objectContaining({ companionCustomerId: 'cust-9', driverCustomerId: 'cust-8', role: 'RESPONSIBLE', reason: 'Brevete extranjero no valido en Peru', companionLicenseVerified: true, driverLicenseVerified: true }),
      }),
      fakeTx,
    );
    expect(d.outbox.publish).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'AcompananteAutorizadoRegistrado.v1' }), fakeTx);
  });

  it('la adenda es opcional (null) y el tipo de titular sale del contrato', async () => {
    const d = build({ ...baseRental, status: 'PENDING_DELIVERY', contract: naturalContract });
    await expect(d.handler.execute(cmd())).resolves.toBeDefined();
    expect(d.rentals.addAuthorizedDriver).toHaveBeenCalledWith(expect.objectContaining({ addendumDocumentRef: null }), fakeTx);
  });

  it('persona JURIDICA -> 422 COMPANION_NOT_APPLICABLE_FOR_LEGAL_HOLDER (por holderType o por contrato)', async () => {
    const a = build(baseRental, true, 'CE');
    await expect(a.handler.execute(cmd({ holderType: 'LEGAL' }))).rejects.toMatchObject({ code: 'COMPANION_NOT_APPLICABLE_FOR_LEGAL_HOLDER', httpStatus: 422 });
    const b = build({ ...baseRental, contract: { ...naturalContract, contractVariant: 'LEGAL_NO_DRIVER' } });
    await expect(b.handler.execute(cmd())).rejects.toMatchObject({ code: 'COMPANION_NOT_APPLICABLE_FOR_LEGAL_HOLDER' });
    expect(a.rentals.addAuthorizedDriver).not.toHaveBeenCalled();
  });

  it('sin contrato ni holderType -> 422 HOLDER_TYPE_REQUIRED; holderType distinto del contrato -> 422 HOLDER_TYPE_MISMATCH', async () => {
    await expect(build(baseRental, true, 'CE').handler.execute(cmd())).rejects.toMatchObject({ code: 'HOLDER_TYPE_REQUIRED' });
    const withContract = build({ ...baseRental, contract: naturalContract });
    await expect(withContract.handler.execute(cmd({ holderType: 'LEGAL' }))).rejects.toMatchObject({ code: 'HOLDER_TYPE_MISMATCH' });
  });

  it('deduce el tipo de titular del documento: RUC -> juridica (422), DNI -> natural (sin enviar holderType)', async () => {
    const ruc = build(baseRental, true, 'RUC');
    await expect(ruc.handler.execute(cmd())).rejects.toMatchObject({ code: 'COMPANION_NOT_APPLICABLE_FOR_LEGAL_HOLDER' });
    await expect(build().handler.execute(cmd())).resolves.toBeDefined();
    await expect(build(baseRental, true, 'DNI').handler.execute(cmd({ holderType: 'LEGAL' }))).rejects.toMatchObject({ code: 'HOLDER_TYPE_MISMATCH' });
  });

  it('exige el conductor real y los checks de licencia verificada (la licencia no se guarda)', async () => {
    await expect(build().handler.execute(cmd({ companionLic: false }))).rejects.toMatchObject({ code: 'LICENSE_VERIFICATION_REQUIRED', httpStatus: 422 });
    await expect(build().handler.execute(cmd({ driverLic: false }))).rejects.toMatchObject({ code: 'LICENSE_VERIFICATION_REQUIRED' });
    await expect(build().handler.execute(cmd({ driver: 'cust-9' }))).rejects.toMatchObject({ code: 'COMPANION_DRIVER_MUST_DIFFER' });
    await expect(build().handler.execute(cmd({ driver: 'cust-1' }))).rejects.toMatchObject({ code: 'RENTAL_DRIVER_ALREADY_REGISTERED' });
    await expect(build().handler.execute(cmd({ driver: 'cust-404' }))).rejects.toMatchObject({ response: { code: 'DRIVER_CUSTOMER_NOT_FOUND' } });
    const d = build();
    await expect(d.handler.execute(cmd({ companionLic: false }))).rejects.toBeDefined();
    expect(d.rentals.addAuthorizedDriver).not.toHaveBeenCalled();
  });

  it('valida el maximo de acompanantes contra la capacidad de pasajeros cuando Flota la expone', async () => {
    const full = { ...baseRental, vehiclePassengerCapacity: 1, parties: [...baseRental.parties!, { id: 'p2', rentalId: 'rent-1', customerId: 'cust-7', role: 'RESPONSIBLE', createdAt: new Date() }] } as RentalRecord;
    await expect(build(full).handler.execute(cmd())).rejects.toMatchObject({ code: 'COMPANION_PASSENGER_CAPACITY_EXCEEDED', httpStatus: 422 });
    await expect(build({ ...full, vehiclePassengerCapacity: 2 }).handler.execute(cmd())).resolves.toBeDefined();
    await expect(build({ ...full, vehiclePassengerCapacity: null }).handler.execute(cmd())).resolves.toBeDefined(); // TODO: sin campo en Flota no se valida
  });

  it('exige el motivo (400), rechaza duplicados (409) y acompanante inexistente (422)', async () => {
    await expect(build().handler.execute(cmd({ holderType: 'NATURAL', reason: '   ' }))).rejects.toMatchObject({ code: 'COMPANION_REASON_REQUIRED' });
    await expect(build().handler.execute(cmd({ holderType: 'NATURAL', companion: 'cust-1' }))).rejects.toMatchObject({ code: 'RENTAL_DRIVER_ALREADY_REGISTERED' });
    await expect(build(baseRental, false).handler.execute(cmd({ holderType: 'NATURAL' }))).rejects.toMatchObject({ response: { code: 'COMPANION_CUSTOMER_NOT_FOUND' } });
  });

  it('solo antes de la entrega (409 RENTAL_DRIVER_REGISTRATION_CLOSED) y 404 si no existe', async () => {
    await expect(build({ ...baseRental, status: 'ACTIVE' }).handler.execute(cmd({ holderType: 'NATURAL' }))).rejects.toMatchObject({ code: 'RENTAL_DRIVER_REGISTRATION_CLOSED' });
    const d = build();
    (d.rentals.findById as jest.Mock).mockResolvedValue(null);
    await expect(d.handler.execute(cmd({ holderType: 'NATURAL' }))).rejects.toBeInstanceOf(NotFoundException);
  });
});
