import { BadRequestException, ForbiddenException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConvertToReservationHandler } from './convert-to-reservation.handler';
import { ConvertToReservationCommand } from './convert-to-reservation.command';
import { ProvisionalQuotingGuard } from '../services/provisional-quoting.guard';
import { InquiryNotTransitionableError, QuotationExpiredError } from '../../domain/inquiry-errors';
import { ReservationRepositoryPort } from '../../../reservations/application/ports/reservation-repository.port';
import { InquiryAlreadyHasReservationError } from '../../../reservations/domain/reservation-errors';
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
  buildQuotation,
  buildTransactionManager,
  buildWorkContext,
  buildMatrixAuth,
} from '../../testing/inquiry-test-fixtures';

const NOW = new Date('2026-09-23T15:00:00Z');
const START = new Date('2026-10-01T14:00:00Z');

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
} = {}) {
  const existing = options.existing === undefined ? quotedInquiry() : options.existing;
  const inquiries = buildInquiryRepository(existing);
  const reservations = {
    create: jest.fn().mockResolvedValue({ id: 'res-1', inquiryId: 'inq-1', status: 'DRAFT' }),
  } as unknown as jest.Mocked<ReservationRepositoryPort>;
  const audit = { recordInquiryEvent: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<AuditEventRepositoryPort>;
  const outbox = { publish: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<OutboxEventRepositoryPort>;
  const transactions = buildTransactionManager();
  const fleet = { productionReady: false } as any;
  const rateCards = { productionReady: false } as any;
  const guard = new ProvisionalQuotingGuard(fleet, rateCards, { production: options.production ?? false, allowProvisional: false });
  const clock = new FixedClock(options.now ?? NOW);
  const depositPolicy = {
    getCurrent: jest.fn().mockResolvedValue({ version: 1, amount: '300.00', currency: 'PEN', effectiveFrom: null }),
    listHistory: jest.fn(),
    createVersion: jest.fn(),
  };
  const matrixAuth = buildMatrixAuth();
  const handler = new ConvertToReservationHandler(
    inquiries,
    reservations,
    buildWorkContext(options.role),
    audit,
    outbox,
    transactions,
    guard,
    clock,
    depositPolicy,
    matrixAuth,
  );
  return { handler, inquiries, reservations, audit, outbox, transactions, clock, depositPolicy, matrixAuth };
}

const command = (startAt: Date = START) =>
  new ConvertToReservationCommand('inq-1', 'uid-1', COMPANY, BRANCH, 2, 'PRESENCIAL', startAt);

describe('ConvertToReservationHandler (caso de uso unico Consulta -> Reserva)', () => {
  it('en UNA transaccion Serializable: transiciona a CONVERTIDA, crea la reserva desde la cotizacion vigente y audita', async () => {
    const { handler, inquiries, reservations, audit, outbox, transactions } = build();

    const result = await handler.execute(command());

    expect(transactions.run).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' });
    expect(inquiries.findById).toHaveBeenLastCalledWith('inq-1', SCOPE, transactions.tx);
    expect(inquiries.convertToReservation).toHaveBeenCalledWith({ id: 'inq-1', ...SCOPE, expectedVersion: 2 }, ['COTIZADA'], transactions.tx);
    expect(reservations.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ORG,
        operatingCompanyId: COMPANY,
        branchId: BRANCH,
        inquiryId: 'inq-1',
        customerId: 'cust-1',
        vehicleId: 'veh-new',
        startAt: START,
        endAt: new Date('2026-10-03T14:00:00Z'),
      }),
      transactions.tx,
    );
    expect(audit.recordInquiryEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'INQUIRY_CONVERTED_TO_RESERVATION', changes: expect.objectContaining({ quotationId: 'quo-new', reservationId: 'res-1' }) }),
      transactions.tx,
    );
    expect(outbox.publish).toHaveBeenCalledWith(
      expect.objectContaining({ aggregateType: 'Reservation', aggregateId: 'res-1', eventType: 'ReservationCreated' }),
      transactions.tx,
    );
    expect(result.reservation.id).toBe('res-1');
  });

  describe('vigencia de la cotizacion (hallazgo ALTO "acepta cotizaciones vencidas")', () => {
    it('rechaza con 409 QUOTATION_EXPIRED si la cotizacion mas reciente ya vencio, sin crear la reserva', async () => {
      const { handler, reservations, inquiries } = build({ now: new Date('2026-09-26T10:00:00Z') });

      await expect(handler.execute(command())).rejects.toBeInstanceOf(QuotationExpiredError);
      expect(inquiries.convertToReservation).not.toHaveBeenCalled();
      expect(reservations.create).not.toHaveBeenCalled();
    });

    it('no "salta" a una cotizacion mas antigua aunque la mas reciente haya vencido', async () => {
      const inquiry = quotedInquiry({
        quotations: [
          buildQuotation({ id: 'quo-old', createdAt: new Date('2026-09-20T10:00:00Z'), validUntil: new Date('2026-12-31T00:00:00Z') }),
          buildQuotation({ id: 'quo-new', createdAt: new Date('2026-09-21T10:00:00Z'), validUntil: new Date('2026-09-22T00:00:00Z') }),
        ],
      });
      const { handler, reservations } = build({ existing: inquiry });

      await expect(handler.execute(command())).rejects.toBeInstanceOf(QuotationExpiredError);
      expect(reservations.create).not.toHaveBeenCalled();
    });

    it('evalua la vigencia DENTRO de la transaccion (carrera: vence entre la pre-validacion y el commit)', async () => {
      const { handler, reservations, transactions, clock } = build();
      transactions.run.mockImplementation(async (work: any) => {
        clock.set(new Date('2026-09-27T00:00:00Z')); // el reloj avanza mientras espera la transaccion
        return work(transactions.tx);
      });

      await expect(handler.execute(command())).rejects.toBeInstanceOf(QuotationExpiredError);
      expect(reservations.create).not.toHaveBeenCalled();
    });

    it('usa el estado RE-LEIDO dentro de la transaccion (si alguien recotizo, usa la nueva cotizacion)', async () => {
      const { handler, inquiries, reservations } = build();
      const requoted = quotedInquiry({
        version: 3,
        quotations: [buildQuotation({ id: 'quo-requoted', vehicleId: 'veh-3', createdAt: new Date('2026-09-23T14:00:00Z') })],
      });
      inquiries.findById.mockResolvedValueOnce(quotedInquiry()).mockResolvedValueOnce(requoted);

      await handler.execute(command());

      expect(reservations.create).toHaveBeenCalledWith(expect.objectContaining({ vehicleId: 'veh-3' }), expect.anything());
    });
  });

  describe('cardinalidad 1:1 (hallazgo CRITICO)', () => {
    it('propaga 409 INQUIRY_ALREADY_CONVERTED cuando la base rechaza una segunda reserva (UNIQUE inquiry_id)', async () => {
      const { handler, reservations } = build();
      reservations.create.mockRejectedValue(new InquiryAlreadyHasReservationError());

      await expect(handler.execute(command())).rejects.toBeInstanceOf(InquiryAlreadyHasReservationError);
    });

    it.each(['REGISTRADA', 'CONVERTIDA', 'CERRADA_SIN_CONVERSION'] as const)('rechaza convertir una consulta %s', async (status) => {
      const { handler, reservations } = build({ existing: quotedInquiry({ status }) });

      await expect(handler.execute(command())).rejects.toBeInstanceOf(InquiryNotTransitionableError);
      expect(reservations.create).not.toHaveBeenCalled();
    });
  });

  it('rechaza una fecha de inicio que no es futura (BDD-CON-001 10.4: inmediata -> Alquiler)', async () => {
    const { handler } = build();

    const error = await handler.execute(command(NOW)).catch((e) => e);

    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.getResponse()).toEqual(expect.objectContaining({ code: 'RESERVATION_START_NOT_IN_FUTURE' }));
  });

  it('rechaza si la consulta no tiene cliente formal asociado', async () => {
    const { handler } = build({ existing: quotedInquiry({ customerId: null }) });

    const error = await handler.execute(command()).catch((e) => e);

    expect(error.getResponse()).toEqual(expect.objectContaining({ code: 'CUSTOMER_REQUIRED_FOR_CONVERSION' }));
  });

  it('responde 404 si la consulta no esta en el scope (otra sede/empresa)', async () => {
    const { handler } = build({ existing: null });

    await expect(handler.execute(command())).rejects.toBeInstanceOf(NotFoundException);
  });

  it.each(['GERENCIA', 'AUDITORIA', 'CAMPO'] as const)('RBAC: rechaza convertir con rol %s', async (role) => {
    const { handler, transactions } = build({ role });

    await expect(handler.execute(command())).rejects.toBeInstanceOf(ForbiddenException);
    expect(transactions.run).not.toHaveBeenCalled();
  });

  it('en produccion, con Flota/tarifario provisionales, responde 503 sin tocar la base', async () => {
    const { handler, transactions } = build({ production: true });

    await expect(handler.execute(command())).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(transactions.run).not.toHaveBeenCalled();
  });

  it('consulta MatrixAuthorizationService para INQUIRY.CONVERT_TO_RESERVATION y RESERVATION.CREATE', async () => {
    const { handler, matrixAuth } = build();

    await handler.execute(command());

    expect(matrixAuth.assertAllowed).toHaveBeenCalledWith(ORG, 'FRONT_OFFICE', 'INQUIRY', 'CONVERT_TO_RESERVATION');
    expect(matrixAuth.assertAllowed).toHaveBeenCalledWith(ORG, 'FRONT_OFFICE', 'RESERVATION', 'CREATE');
  });

  it('rechaza si el rol no tiene permiso RESERVATION.CREATE aunque tenga INQUIRY.CONVERT_TO_RESERVATION', async () => {
    const { handler, matrixAuth, transactions } = build();
    matrixAuth.assertAllowed.mockImplementation(async (_org, _role, module, action) => {
      if (module === 'RESERVATION' && action === 'CREATE') {
        throw new ForbiddenException();
      }
    });

    await expect(handler.execute(command())).rejects.toBeInstanceOf(ForbiddenException);
    expect(transactions.run).not.toHaveBeenCalled();
  });
});
