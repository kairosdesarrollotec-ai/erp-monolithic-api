import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConvertToRentalHandler } from './convert-to-rental.handler';
import { ConvertToRentalCommand } from './convert-to-rental.command';
import { ProvisionalQuotingGuard } from '../services/provisional-quoting.guard';
import { InquiryNotTransitionableError, QuotationExpiredError, QuotingNotProductionReadyError } from '../../domain/inquiry-errors';
import { RentalRepositoryPort } from '../../../rentals/application/ports/rental-repository.port';
import { RentalCreationGuard } from '../../../rentals/application/services/rental-creation.guard';
import { CustomerBlockedError, VehicleNotAvailableForRentalError } from '../../../rentals/domain/rental-errors';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import {
  BRANCH,
  COMPANY,
  FixedClock,
  ORG,
  SCOPE,
  buildInquiry,
  buildInquiryRepository,
  buildMatrixAuth,
  buildQuotation,
  buildTransactionManager,
  buildWorkContext,
} from '../../testing/inquiry-test-fixtures';

const NOW = new Date('2026-09-23T15:00:00Z');

function quotedInquiry(overrides: Parameters<typeof buildInquiry>[0] = {}) {
  return buildInquiry({
    status: 'COTIZADA',
    version: 2,
    quotations: [
      buildQuotation({ id: 'quo-old', vehicleId: 'veh-old', estimatedDays: 5, createdAt: new Date('2026-09-22T10:00:00Z'), validUntil: new Date('2026-09-25T10:00:00Z') }),
      buildQuotation({ id: 'quo-new', vehicleId: 'veh-new', estimatedDays: 2, createdAt: new Date('2026-09-23T10:00:00Z'), validUntil: new Date('2026-09-26T10:00:00Z') }),
    ],
    ...overrides,
  });
}

function build(options: {
  existing?: ReturnType<typeof buildInquiry> | null;
  role?: Parameters<typeof buildWorkContext>[0];
  production?: boolean;
  now?: Date;
  customerStatus?: string;
  vehicle?: Record<string, unknown> | null;
  overlap?: boolean;
} = {}) {
  const existing = options.existing === undefined ? quotedInquiry() : options.existing;
  const inquiries = buildInquiryRepository(existing);
  const rentals = {
    findCustomerById: jest.fn().mockResolvedValue({
      id: 'cust-1', organizationId: ORG, operatingCompanyId: COMPANY, fullName: 'Ana', documentNumber: '1', status: options.customerStatus ?? 'NORMAL',
    }),
    findVehicleById: jest.fn().mockResolvedValue(
      options.vehicle === undefined
        ? { id: 'veh-new', organizationId: ORG, operatingCompanyId: COMPANY, branchId: BRANCH, plate: 'P', brand: 'T', model: 'C', status: 'AVAILABLE' }
        : options.vehicle,
    ),
    hasBlockingVehicleCommitment: jest.fn().mockResolvedValue(options.overlap ?? false),
    create: jest.fn().mockResolvedValue({
      id: 'rent-1', inquiryId: 'inq-1', status: 'DRAFT', customerId: 'cust-1', vehicleId: 'veh-new', planCode: 'NORMAL',
      startAt: null, expectedEndAt: null, createdAt: new Date('2026-09-23T15:00:00Z'),
    }),
  } as unknown as jest.Mocked<RentalRepositoryPort>;
  const audit = {
    recordInquiryEvent: jest.fn().mockResolvedValue(undefined),
    recordRentalEvent: jest.fn().mockResolvedValue(undefined),
    recordIncidentEvent: jest.fn(),
  } as unknown as jest.Mocked<AuditEventRepositoryPort>;
  const outbox = { publish: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<OutboxEventRepositoryPort>;
  const transactions = buildTransactionManager();
  const quotingGuard = new ProvisionalQuotingGuard({ productionReady: false } as any, { production: options.production ?? false, allowProvisional: false });
  const clock = new FixedClock(options.now ?? NOW);
  const matrixAuth = buildMatrixAuth();
  const creationGuard = new RentalCreationGuard(rentals, clock);
  const handler = new ConvertToRentalHandler(
    inquiries,
    rentals,
    buildWorkContext(options.role),
    audit,
    outbox,
    transactions,
    quotingGuard,
    clock,
    matrixAuth,
    creationGuard,
  );
  return { handler, inquiries, rentals, audit, outbox, transactions, clock, matrixAuth };
}

const command = (planCode?: string) => new ConvertToRentalCommand('inq-1', 'uid-1', COMPANY, BRANCH, 2, planCode);

describe('ConvertToRentalHandler (caso de uso unico Consulta -> Alquiler directo)', () => {
  it('en UNA transaccion Serializable: valida, transiciona a CONVERTIDA, crea el Rental DRAFT sin fechas y audita + outbox', async () => {
    const { handler, inquiries, rentals, audit, outbox, transactions } = build();

    const result = await handler.execute(command('PLUS'));

    expect(transactions.run).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' });
    expect(inquiries.findById).toHaveBeenLastCalledWith('inq-1', SCOPE, transactions.tx);
    expect(inquiries.convertToRental).toHaveBeenCalledWith({ id: 'inq-1', ...SCOPE, expectedVersion: 2 }, ['COTIZADA'], transactions.tx);
    expect(inquiries.convertToReservation).not.toHaveBeenCalled();

    const [input, tx] = rentals.create.mock.calls[0];
    expect(tx).toBe(transactions.tx);
    expect(input).toEqual({
      organizationId: ORG,
      operatingCompanyId: COMPANY,
      branchId: BRANCH,
      customerId: 'cust-1',
      vehicleId: 'veh-new', // de la cotizacion vigente mas reciente
      planCode: 'PLUS',
      inquiryId: 'inq-1',
      createdBy: 'uid-1',
    });
    expect(input).not.toHaveProperty('startAt');
    expect(input).not.toHaveProperty('expectedEndAt');

    expect(audit.recordInquiryEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'INQUIRY_CONVERTED_TO_RENTAL', changes: expect.objectContaining({ rentalId: 'rent-1', quotationId: 'quo-new' }) }),
      transactions.tx,
    );
    expect(audit.recordRentalEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'RENTAL_CREATED_FROM_INQUIRY', rentalId: 'rent-1' }),
      transactions.tx,
    );
    expect(outbox.publish).toHaveBeenCalledWith(
      expect.objectContaining({ aggregateType: 'rental', aggregateId: 'rent-1', eventType: 'RentalCreatedFromInquiry.v1' }),
      transactions.tx,
    );
    expect(result.rental.id).toBe('rent-1');
    expect(result.inquiry.status).toBe('CONVERTIDA');
  });

  it('planCode por defecto NORMAL', async () => {
    const { handler, rentals } = build();
    await handler.execute(command());
    expect(rentals.create).toHaveBeenCalledWith(expect.objectContaining({ planCode: 'NORMAL' }), expect.anything());
  });

  it('valida disponibilidad del vehiculo de la cotizacion en [ahora, ahora + estimatedDays)', async () => {
    const { handler, rentals, transactions } = build();
    await handler.execute(command());
    expect(rentals.hasBlockingVehicleCommitment).toHaveBeenCalledWith('veh-new', ORG, NOW, new Date('2026-09-25T15:00:00Z'), transactions.tx);
  });

  describe('estado y precondiciones de la consulta', () => {
    it.each(['REGISTRADA', 'CONVERTIDA', 'CERRADA_SIN_CONVERSION'] as const)('consulta %s -> 422 INQUIRY_NOT_TRANSITIONABLE', async (status) => {
      const { handler, rentals, inquiries } = build({ existing: quotedInquiry({ status }) });
      await expect(handler.execute(command())).rejects.toBeInstanceOf(InquiryNotTransitionableError);
      expect(inquiries.convertToRental).not.toHaveBeenCalled();
      expect(rentals.create).not.toHaveBeenCalled();
    });

    it('consulta inexistente en el scope -> 404', async () => {
      const { handler } = build({ existing: null });
      await expect(handler.execute(command())).rejects.toBeInstanceOf(NotFoundException);
    });

    it('sin cliente asociado -> 400 CUSTOMER_REQUIRED_FOR_CONVERSION', async () => {
      const { handler, rentals } = build({ existing: quotedInquiry({ customerId: null }) });
      await expect(handler.execute(command())).rejects.toBeInstanceOf(BadRequestException);
      expect(rentals.create).not.toHaveBeenCalled();
    });

    it('cotizacion mas reciente vencida -> 409 QUOTATION_EXPIRED, sin crear el alquiler', async () => {
      const { handler, rentals, inquiries } = build({ now: new Date('2026-09-26T10:00:00Z') });
      await expect(handler.execute(command())).rejects.toBeInstanceOf(QuotationExpiredError);
      expect(inquiries.convertToRental).not.toHaveBeenCalled();
      expect(rentals.create).not.toHaveBeenCalled();
    });

    it('COTIZADA sin cotizaciones -> INQUIRY_NOT_TRANSITIONABLE', async () => {
      const { handler } = build({ existing: quotedInquiry({ quotations: [] }) });
      await expect(handler.execute(command())).rejects.toBeInstanceOf(InquiryNotTransitionableError);
    });
  });

  describe('endurecimiento de alquiler (ALQ-02)', () => {
    it('cliente ROJO -> 422 CUSTOMER_BLOCKED, sin convertir ni crear', async () => {
      const { handler, rentals, inquiries } = build({ customerStatus: 'ROJO' });
      await expect(handler.execute(command())).rejects.toBeInstanceOf(CustomerBlockedError);
      expect(inquiries.convertToRental).not.toHaveBeenCalled();
      expect(rentals.create).not.toHaveBeenCalled();
    });

    it('cliente de otra empresa -> 404 CUSTOMER_NOT_FOUND', async () => {
      const { handler, rentals } = build();
      rentals.findCustomerById.mockResolvedValueOnce({ id: 'cust-1', organizationId: ORG, operatingCompanyId: 'otra', fullName: 'X', documentNumber: '1', status: 'NORMAL' });
      await expect(handler.execute(command())).rejects.toBeInstanceOf(NotFoundException);
    });

    it('vehiculo inexistente / de otra empresa -> 404 VEHICLE_NOT_FOUND', async () => {
      const { handler } = build({ vehicle: null });
      await expect(handler.execute(command())).rejects.toBeInstanceOf(NotFoundException);
    });

    it.each([
      ['no AVAILABLE', { status: 'MAINTENANCE', branchId: BRANCH }],
      ['de otra sede', { status: 'AVAILABLE', branchId: 'otra-sede' }],
    ])('vehiculo %s -> 409 VEHICLE_NOT_AVAILABLE', async (_label, patch) => {
      const { handler, rentals, inquiries } = build({
        vehicle: { id: 'veh-new', organizationId: ORG, operatingCompanyId: COMPANY, plate: 'P', brand: 'T', model: 'C', ...patch },
      });
      await expect(handler.execute(command())).rejects.toBeInstanceOf(VehicleNotAvailableForRentalError);
      expect(inquiries.convertToRental).not.toHaveBeenCalled();
      expect(rentals.create).not.toHaveBeenCalled();
    });

    it('solape con reserva/compromiso -> 409 VEHICLE_NOT_AVAILABLE', async () => {
      const { handler, rentals } = build({ overlap: true });
      await expect(handler.execute(command())).rejects.toBeInstanceOf(VehicleNotAvailableForRentalError);
      expect(rentals.create).not.toHaveBeenCalled();
    });
  });

  describe('RBAC y guardas', () => {
    it.each(['GERENCIA', 'AUDITORIA', 'ADMINISTRACION', 'FINANZAS'] as const)('rol %s -> 403 ROLE_NOT_ALLOWED', async (role) => {
      const { handler, rentals } = build({ role });
      await expect(handler.execute(command())).rejects.toBeInstanceOf(ForbiddenException);
      expect(rentals.create).not.toHaveBeenCalled();
    });

    it('exige INQUIRY.CONVERT_TO_RENTAL y RENTAL.CREATE en la matriz', async () => {
      const { handler, matrixAuth } = build();
      await handler.execute(command());
      expect(matrixAuth.assertAllowed).toHaveBeenCalledWith(ORG, 'FRONT_OFFICE', 'INQUIRY', 'CONVERT_TO_RENTAL');
      expect(matrixAuth.assertAllowed).toHaveBeenCalledWith(ORG, 'FRONT_OFFICE', 'RENTAL', 'CREATE');
    });

    it('asignacion de contexto no vigente -> 403', async () => {
      const { handler } = build({ role: 'forbidden' });
      await expect(handler.execute(command())).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('produccion con Flota provisional -> 503 QUOTING_NOT_PRODUCTION_READY', async () => {
      const { handler, rentals } = build({ production: true });
      await expect(handler.execute(command())).rejects.toBeInstanceOf(QuotingNotProductionReadyError);
      expect(rentals.create).not.toHaveBeenCalled();
    });
  });
});
