import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FormalizeContractHandler } from './formalize-contract.handler';
import { FormalizeContractCommand } from './formalize-contract.command';
import { RentalRepositoryPort, RentalRecord } from '../ports/rental-repository.port';
import { TemplateRepositoryPort, TemplateRecord } from '../../../templates/application/ports/template-repository.port';
import { ContractTemplateResolver } from '../services/contract-template-resolver';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import { RentalStateConflictError } from '../../domain/rental-errors';
import {
  ReservationCreditCurrencyMismatchError,
  ReservationCreditSource,
} from '../../domain/reservation-credit';
import { testRole } from '../../../users/testing/role-fixtures';

describe('FormalizeContractHandler', () => {
  const fakeRental: RentalRecord = {
    id: 'rent-500',
    organizationId: 'org-1',
    operatingCompanyId: 'comp-1',
    branchId: 'branch-1',
    inquiryId: null,
    reservationId: null,
    customerId: 'cust-1',
    customerName: 'Luis Vargas',
    customerDocNumber: '22334455',
    vehicleId: 'veh-1',
    vehiclePlate: 'JKL-004',
    vehicleBrand: 'Toyota',
    vehicleModel: 'Yaris',
    vehicleDepositMinimum: null,
    planCode: 'NORMAL',
    status: 'CONTRACTING',
    startAt: new Date(),
    expectedEndAt: new Date(Date.now() + 86400000),
    alcoholTestResult: 'FAVORABLE',
    createdAt: new Date(),
    createdBy: 'uid-user',
    updatedAt: new Date(),
    updatedBy: 'uid-user',
    version: 4,
  };

  const fakeTx = {} as any;

  function template(type: string, id: string): TemplateRecord {
    return {
      id,
      organizationId: 'org-1',
      companyId: 'comp-1',
      type,
      name: `Contrato ${type}`,
      version: 1,
      status: 'ACTIVE',
      documentUrl: 'https://storage.example.com/tpl.pdf',
      documentFormat: 'PDF',
      effectiveFrom: new Date(),
      createdAt: new Date(),
      createdBy: 'uid-admin',
      updatedAt: new Date(),
      updatedBy: 'uid-admin',
    };
  }

  const genericTemplate = template('RENTAL_CONTRACT', 'tpl-active');

  function reservationSource(overrides: Partial<ReservationCreditSource> = {}): ReservationCreditSource {
    return {
      reservationId: 'res-1',
      status: 'CONFIRMED',
      amount: '300.00',
      currency: 'PEN',
      paymentValidatedAt: new Date('2026-10-01T10:00:00Z'),
      ...overrides,
    };
  }

  function buildDeps(
    options: {
      activeByType?: Record<string, TemplateRecord>;
      rental?: RentalRecord;
      reservation?: ReservationCreditSource | null;
    } = {},
  ) {
    const activeByType = options.activeByType ?? { RENTAL_CONTRACT: genericTemplate };
    const rental = options.rental ?? fakeRental;
    const rentals = {
      findById: jest.fn().mockResolvedValue(rental),
      findReservationCreditSource: jest.fn().mockResolvedValue(options.reservation ?? null),
      formalizeContract: jest.fn().mockResolvedValue({ ...rental, status: 'PENDING_DELIVERY', version: 5 }),
    } as unknown as jest.Mocked<RentalRepositoryPort>;

    const templateRepository = {
      findActive: jest.fn(async (_c: string, type: string) => activeByType[type] ?? null),
    } as unknown as jest.Mocked<TemplateRepositoryPort>;
    const templateResolver = new ContractTemplateResolver(templateRepository);

    const workContext = {
      authorize: jest.fn().mockResolvedValue({
        organizationId: 'org-1',
        companyId: 'comp-1',
        branchId: 'branch-1',
        ...testRole('FRONT_OFFICE'),
      }),
    } as unknown as jest.Mocked<WorkContextAuthorizationService>;

    const matrixAuth = {
      assertAllowed: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<MatrixAuthorizationService>;

    const transactionManager: jest.Mocked<TransactionManagerPort> = {
      run: jest.fn((work: any) => work(fakeTx)),
    };

    const auditRepository = {
      recordRentalEvent: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AuditEventRepositoryPort>;

    const outboxRepository: jest.Mocked<OutboxEventRepositoryPort> = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    const handler = new FormalizeContractHandler(
      rentals,
      templateResolver,
      workContext,
      matrixAuth,
      transactionManager,
      auditRepository,
      outboxRepository,
    );

    return { handler, rentals, templateRepository, workContext, matrixAuth, transactionManager, auditRepository, outboxRepository };
  }

  function command(overrides: {
    id?: string;
    depositAmount?: string;
    depositCurrency?: string;
    contractVariant?: ConstructorParameters<typeof FormalizeContractCommand>[9];
  } = {}) {
    return new FormalizeContractCommand(
      overrides.id ?? 'rent-500',
      'uid-1',
      'comp-1',
      'branch-1',
      4,
      'doc-ref-001',
      overrides.depositAmount ?? (overrides.contractVariant?.withCompanyDriver ? undefined : '500.00'),
      overrides.depositCurrency ?? (overrides.contractVariant?.withCompanyDriver ? undefined : 'PEN'),
      undefined,
      overrides.contractVariant,
    );
  }

  const reservationRental: RentalRecord = { ...fakeRental, reservationId: 'res-1' };

  it('TPL-TODO-001: resuelve la plantilla activa desde templates y transiciona a PENDING_DELIVERY', async () => {
    const deps = buildDeps();

    const result = await deps.handler.execute(command());

    expect(result.status).toBe('PENDING_DELIVERY');
    expect(deps.templateRepository.findActive).toHaveBeenCalledWith('comp-1', 'RENTAL_CONTRACT', 'org-1');
    expect(deps.rentals.formalizeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        rentalId: 'rent-500',
        templateId: 'tpl-active',
        depositAmount: '500.00',
        reservationCreditAmount: '0.00',
      }),
      fakeTx,
    );
    expect(deps.auditRepository.recordRentalEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CONTRACT_FORMALIZED', changes: expect.objectContaining({ templateId: 'tpl-active' }) }),
      fakeTx,
    );
    const publishCalls = deps.outboxRepository.publish.mock.calls.map((c) => c[0].eventType);
    expect(publishCalls).toContain('ContratoFirmado.v1');
    expect(publishCalls).toContain('PagoRegistrado.v1');
  });

  it('monto deposito <= 0 → BadRequestException con code INVALID_DEPOSIT_AMOUNT', async () => {
    const deps = buildDeps();

    await expect(deps.handler.execute(command({ depositAmount: '0' }))).rejects.toThrow(BadRequestException);
    await expect(deps.handler.execute(command({ depositAmount: '-50' }))).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'INVALID_DEPOSIT_AMOUNT' }),
    });
  });

  it('estado distinto de CONTRACTING → RentalStateConflictError', async () => {
    const deps = buildDeps();
    deps.rentals.findById.mockResolvedValue({ ...fakeRental, status: 'DRAFT' });

    await expect(deps.handler.execute(command())).rejects.toThrow(RentalStateConflictError);
  });

  it('sin plantilla ACTIVE en tabla templates → BadRequestException con code NO_ACTIVE_CONTRACT_TEMPLATE', async () => {
    const deps = buildDeps({ activeByType: {} });

    await expect(deps.handler.execute(command())).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'NO_ACTIVE_CONTRACT_TEMPLATE' }),
    });
  });

  it('alquiler no encontrado → NotFoundException', async () => {
    const deps = buildDeps();
    deps.rentals.findById.mockResolvedValue(null);

    await expect(deps.handler.execute(command({ id: 'rent-inexistente' }))).rejects.toThrow(NotFoundException);
  });

  describe('BR-DOC-003 - seleccion de plantilla por combinacion', () => {
    it('usa la plantilla de la combinacion elegida y registra la combinacion en contrato y auditoria', async () => {
      const deps = buildDeps({
        activeByType: {
          RENTAL_CONTRACT: genericTemplate,
          RENTAL_CONTRACT_LEGAL_DRIVER: template('RENTAL_CONTRACT_LEGAL_DRIVER', 'tpl-legal-driver'),
        },
      });

      await deps.handler.execute(command({ contractVariant: { holderType: 'LEGAL', withCompanyDriver: true } }));

      expect(deps.templateRepository.findActive).toHaveBeenCalledWith('comp-1', 'RENTAL_CONTRACT_LEGAL_DRIVER', 'org-1');
      expect(deps.rentals.formalizeContract).toHaveBeenCalledWith(
        expect.objectContaining({ templateId: 'tpl-legal-driver', contractVariant: 'LEGAL_WITH_DRIVER' }),
        fakeTx,
      );
      expect(deps.auditRepository.recordRentalEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          changes: expect.objectContaining({
            templateId: 'tpl-legal-driver',
            contractVariant: 'LEGAL_WITH_DRIVER',
            templateFallbackUsed: false,
          }),
        }),
        fakeTx,
      );
    });

    it('natural sin conductor y natural con conductor usan plantillas distintas', async () => {
      const activeByType = {
        RENTAL_CONTRACT_NATURAL: template('RENTAL_CONTRACT_NATURAL', 'tpl-nat'),
        RENTAL_CONTRACT_NATURAL_DRIVER: template('RENTAL_CONTRACT_NATURAL_DRIVER', 'tpl-nat-drv'),
      };
      const a = buildDeps({ activeByType });
      await a.handler.execute(command({ contractVariant: { holderType: 'NATURAL', withCompanyDriver: false } }));
      expect(a.rentals.formalizeContract).toHaveBeenCalledWith(expect.objectContaining({ templateId: 'tpl-nat' }), fakeTx);

      const b = buildDeps({ activeByType });
      await b.handler.execute(command({ contractVariant: { holderType: 'NATURAL', withCompanyDriver: true } }));
      expect(b.rentals.formalizeContract).toHaveBeenCalledWith(expect.objectContaining({ templateId: 'tpl-nat-drv' }), fakeTx);
    });

    it('si la empresa aun no cargo la plantilla de la combinacion, usa la generica y lo audita', async () => {
      const deps = buildDeps();

      await deps.handler.execute(command({ contractVariant: { holderType: 'NATURAL', withCompanyDriver: false } }));

      expect(deps.rentals.formalizeContract).toHaveBeenCalledWith(
        expect.objectContaining({ templateId: 'tpl-active', contractVariant: 'NATURAL_NO_DRIVER' }),
        fakeTx,
      );
      expect(deps.auditRepository.recordRentalEvent).toHaveBeenCalledWith(
        expect.objectContaining({ changes: expect.objectContaining({ templateFallbackUsed: true }) }),
        fakeTx,
      );
    });

    it('sin plantilla vigente para la combinacion ni generica: error que nombra la combinacion', async () => {
      const deps = buildDeps({ activeByType: {} });

      await expect(
        deps.handler.execute(command({ contractVariant: { holderType: 'LEGAL', withCompanyDriver: false } })),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'NO_ACTIVE_CONTRACT_TEMPLATE',
          detail: expect.stringContaining('persona juridica, sin conductor'),
        }),
      });
      expect(deps.rentals.formalizeContract).not.toHaveBeenCalled();
    });

    it('sin combinacion no registra contractVariant (clientes antiguos)', async () => {
      const deps = buildDeps();

      await deps.handler.execute(command());

      expect(deps.rentals.formalizeContract).toHaveBeenCalledWith(
        expect.objectContaining({ contractVariant: undefined }),
        fakeTx,
      );
    });
  });

  describe('P0-03 opcion (a) - traslado del monto de la reserva a la garantia', () => {
    it('origen Reserva: garantia S/1000 con S/300 de reserva → credito 300, se cobra la diferencia 700, auditado', async () => {
      const deps = buildDeps({ rental: reservationRental, reservation: reservationSource() });

      await deps.handler.execute(command({ depositAmount: '1000.00' }));

      expect(deps.rentals.findReservationCreditSource).toHaveBeenCalledWith('res-1', fakeTx);
      expect(deps.rentals.formalizeContract).toHaveBeenCalledWith(
        expect.objectContaining({ depositAmount: '1000.00', reservationCreditAmount: '300.00' }),
        fakeTx,
      );
      expect(deps.auditRepository.recordRentalEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CONTRACT_FORMALIZED',
          changes: expect.objectContaining({
            reservationId: 'res-1',
            reservationCreditApplied: true,
            reservationCreditReason: 'APPLIED',
            depositAmount: '1000.00',
            reservationCreditAmount: '300.00',
            amountCollected: '700.00',
          }),
        }),
        fakeTx,
      );
      const payment = deps.outboxRepository.publish.mock.calls.find((c) => c[0].eventType === 'PagoRegistrado.v1')![0];
      expect(payment.payload).toMatchObject({
        depositAmount: '1000.00',
        reservationCreditAmount: '300.00',
        amountCollected: '700.00',
      });
    });

    it('alquiler directo (sin reserva): no consulta reservas y cobra la garantia completa', async () => {
      const deps = buildDeps({ rental: fakeRental });

      await deps.handler.execute(command({ depositAmount: '800.00' }));

      expect(deps.rentals.findReservationCreditSource).not.toHaveBeenCalled();
      expect(deps.rentals.formalizeContract).toHaveBeenCalledWith(
        expect.objectContaining({ depositAmount: '800.00', reservationCreditAmount: '0.00' }),
        fakeTx,
      );
      expect(deps.auditRepository.recordRentalEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          changes: expect.objectContaining({
            reservationCreditApplied: false,
            reservationCreditReason: 'NO_RESERVATION',
            amountCollected: '800.00',
          }),
        }),
        fakeTx,
      );
    });

    it('reserva con monto distinto del estandar (S/450): traslada S/450, no S/300', async () => {
      const deps = buildDeps({ rental: reservationRental, reservation: reservationSource({ amount: '450.00' }) });

      await deps.handler.execute(command({ depositAmount: '800.00' }));

      expect(deps.rentals.formalizeContract).toHaveBeenCalledWith(
        expect.objectContaining({ reservationCreditAmount: '450.00' }),
        fakeTx,
      );
      expect(deps.auditRepository.recordRentalEvent).toHaveBeenCalledWith(
        expect.objectContaining({ changes: expect.objectContaining({ amountCollected: '350.00' }) }),
        fakeTx,
      );
    });

    it.each(['CANCELLED'])(
      'reserva %s (cancelada/no-show): no traslada nada y la garantia se cobra completa',
      async (status) => {
        const deps = buildDeps({ rental: reservationRental, reservation: reservationSource({ status }) });

        await deps.handler.execute(command({ depositAmount: '500.00' }));

        expect(deps.rentals.formalizeContract).toHaveBeenCalledWith(
          expect.objectContaining({ reservationCreditAmount: '0.00' }),
          fakeTx,
        );
        expect(deps.auditRepository.recordRentalEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            changes: expect.objectContaining({
              reservationCreditApplied: false,
              reservationCreditReason: 'RESERVATION_NOT_ACTIVE',
              amountCollected: '500.00',
            }),
          }),
          fakeTx,
        );
      },
    );

    it('pago de la reserva nunca validado: no traslada', async () => {
      const deps = buildDeps({
        rental: reservationRental,
        reservation: reservationSource({ paymentValidatedAt: null }),
      });

      await deps.handler.execute(command({ depositAmount: '500.00' }));

      expect(deps.rentals.formalizeContract).toHaveBeenCalledWith(
        expect.objectContaining({ reservationCreditAmount: '0.00' }),
        fakeTx,
      );
    });

    it('monto de reserva mayor que la garantia → NO error: aplica hasta cubrirla y registra el excedente (DEC-ALQ-RESCREDIT-002)', async () => {
      const deps = buildDeps({ rental: reservationRental, reservation: reservationSource({ amount: '600.00' }) });

      await deps.handler.execute(command({ depositAmount: '500.00' }));

      expect(deps.rentals.formalizeContract).toHaveBeenCalledWith(
        expect.objectContaining({
          depositAmount: '500.00',
          reservationCreditAmount: '500.00',
          reservationCreditExcess: '100.00',
        }),
        fakeTx,
      );
      const payment = deps.outboxRepository.publish.mock.calls.find((c) => c[0].eventType === 'PagoRegistrado.v1');
      expect(payment![0].payload).toEqual(
        expect.objectContaining({ amountCollected: '0.00', reservationCreditExcess: '100.00' }),
      );
    });

    it('moneda de la garantia distinta de la de la reserva → RESERVATION_CREDIT_CURRENCY_MISMATCH', async () => {
      const deps = buildDeps({ rental: reservationRental, reservation: reservationSource() });

      await expect(deps.handler.execute(command({ depositAmount: '500.00', depositCurrency: 'USD' }))).rejects.toThrow(
        ReservationCreditCurrencyMismatchError,
      );
      expect(deps.rentals.formalizeContract).not.toHaveBeenCalled();
    });

    it('idempotencia: formalizar dos veces no vuelve a trasladar (la segunda falla por estado y el credito se aplica una sola vez)', async () => {
      const deps = buildDeps({ rental: reservationRental, reservation: reservationSource() });

      await deps.handler.execute(command({ depositAmount: '1000.00' }));
      expect(deps.rentals.formalizeContract).toHaveBeenCalledTimes(1);

      // El alquiler ya quedo en PENDING_DELIVERY: el reintento no llega a persistir.
      deps.rentals.findById.mockResolvedValue({ ...reservationRental, status: 'PENDING_DELIVERY', version: 5 });
      await expect(deps.handler.execute(command({ depositAmount: '1000.00' }))).rejects.toThrow(RentalStateConflictError);

      expect(deps.rentals.formalizeContract).toHaveBeenCalledTimes(1);
      const payments = deps.outboxRepository.publish.mock.calls.filter((c) => c[0].eventType === 'PagoRegistrado.v1');
      expect(payments).toHaveLength(1);
    });

    it('la reserva se lee dentro de la transaccion (no depende de la vista previa)', async () => {
      const deps = buildDeps({ rental: reservationRental, reservation: reservationSource() });

      await deps.handler.execute(command({ depositAmount: '1000.00' }));

      expect(deps.rentals.findReservationCreditSource).toHaveBeenCalledWith('res-1', fakeTx);
    });
  });

  describe('DEC-ALQ-COMPANY-DRIVER-004 - con conductor de la empresa no hay garantia', () => {
    const withDriver = { holderType: 'NATURAL', withCompanyDriver: true } as const;

    it('no exige ni cobra garantia: depositRequired=false, sin monto, y no publica PagoRegistrado', async () => {
      const deps = buildDeps({ activeByType: { RENTAL_CONTRACT_NATURAL_DRIVER: template('RENTAL_CONTRACT_NATURAL_DRIVER', 'tpl-nat-drv') } });

      const result = await deps.handler.execute(command({ contractVariant: withDriver }));

      expect(result.status).toBe('PENDING_DELIVERY');
      expect(deps.rentals.formalizeContract).toHaveBeenCalledWith(
        expect.objectContaining({
          depositRequired: false,
          depositAmount: '0.00',
          reservationCreditAmount: '0.00',
          reservationCreditExcess: '0.00',
          contractVariant: 'NATURAL_WITH_DRIVER',
        }),
        fakeTx,
      );
      expect(deps.outboxRepository.publish.mock.calls.map((c) => c[0].eventType)).toEqual(['ContratoFirmado.v1']);
      expect(deps.auditRepository.recordRentalEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          changes: expect.objectContaining({ depositRequired: false, depositCurrency: null, amountCollected: '0.00' }),
        }),
        fakeTx,
      );
    });

    it('enviar garantia > 0 con conductor de la empresa → 422 DEPOSIT_NOT_APPLICABLE_WITH_COMPANY_DRIVER', async () => {
      const deps = buildDeps();

      await expect(
        deps.handler.execute(command({ contractVariant: withDriver, depositAmount: '500.00', depositCurrency: 'PEN' })),
      ).rejects.toMatchObject({ code: 'DEPOSIT_NOT_APPLICABLE_WITH_COMPANY_DRIVER', httpStatus: 422 });
      expect(deps.rentals.formalizeContract).not.toHaveBeenCalled();
    });

    it('reserva con credito pagado: TODO el credito queda como saldo a favor (sin reembolso automatico)', async () => {
      const deps = buildDeps({
        rental: reservationRental,
        reservation: reservationSource({ amount: '300.00' }),
        activeByType: { RENTAL_CONTRACT_LEGAL_DRIVER: template('RENTAL_CONTRACT_LEGAL_DRIVER', 'tpl-legal-drv') },
      });

      await deps.handler.execute(command({ contractVariant: { holderType: 'LEGAL', withCompanyDriver: true } }));

      expect(deps.rentals.formalizeContract).toHaveBeenCalledWith(
        expect.objectContaining({
          depositRequired: false,
          depositAmount: '0.00',
          reservationCreditAmount: '0.00',
          reservationCreditExcess: '300.00',
          currency: 'PEN',
        }),
        fakeTx,
      );
      expect(deps.auditRepository.recordRentalEvent).toHaveBeenCalledWith(
        expect.objectContaining({ changes: expect.objectContaining({ reservationCreditExcess: '300.00', reservationCreditApplied: true }) }),
        fakeTx,
      );
    });

    it('sin conductor de la empresa la garantia sigue siendo obligatoria (400 INVALID_DEPOSIT_AMOUNT)', async () => {
      const deps = buildDeps();

      await expect(
        deps.handler.execute(
          new FormalizeContractCommand('rent-500', 'uid-1', 'comp-1', 'branch-1', 4, 'doc', undefined, undefined, undefined, {
            holderType: 'NATURAL',
            withCompanyDriver: false,
          }),
        ),
      ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'INVALID_DEPOSIT_AMOUNT' }) });
    });
  });
});
