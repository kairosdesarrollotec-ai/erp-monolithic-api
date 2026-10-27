import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfirmSaleRefundTransferHandler } from './confirm-sale-refund-transfer.handler';
import { ConfirmSaleRefundTransferCommand } from './confirm-sale-refund-transfer.command';
import { ReservationRepositoryPort, ReservationRecord } from '../ports/reservation-repository.port';
import { ReservationSaleResolutionRepositoryPort } from '../ports/reservation-sale-resolution-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { assertReservationRoleAllowed } from '../policies/reservation-role-policy';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import { DomainConflictError } from '../../../../common/domain/domain-errors';
import { roleKeyOfTestRoleId, testRole } from '../../../users/testing/role-fixtures';

function buildRecord(overrides: Partial<ReservationRecord> = {}): ReservationRecord {
  return {
    id: 'res-1',
    organizationId: 'org-1',
    operatingCompanyId: 'company-1',
    branchId: 'branch-1',
    inquiryId: 'inq-1',
    customerId: 'cust-1',
    customerName: 'Maria Quispe',
    vehicleId: 'veh-1',
    vehiclePlate: 'D0Y-704',
    vehicleLabel: 'Toyota Hilux - D0Y-704',
    status: 'CANCELLED',
    channelMode: 'PRESENCIAL',
    startAt: new Date('2026-10-20T14:00:00Z'),
    endAt: new Date('2026-10-22T14:00:00Z'),
    requiredPaymentAmount: '300.00',
    currency: 'PEN',
    paymentPolicyVersion: 1,
    paymentValidatedAt: new Date(),
    documentsCompletedAt: new Date(),
    confirmedAt: new Date(),
    createdAt: new Date(),
    createdBy: 'uid-1',
    version: 3,
    ...overrides,
  };
}

const FAKE_TX = { __fakeTx: true } as any;

function buildDeps(existing: ReservationRecord | null, role = 'GERENCIA') {
  const reservations = {
    findById: jest.fn().mockResolvedValue(existing),
  } as unknown as jest.Mocked<ReservationRepositoryPort>;

  const saleResolutions = {
    confirmRefundTransfer: jest.fn().mockImplementation(async () => ({ ...existing, version: 4 })),
  } as unknown as jest.Mocked<ReservationSaleResolutionRepositoryPort>;

  const workContext = {
    authorize: jest.fn().mockResolvedValue({
      organizationId: 'org-1',
      companyId: 'company-1',
      branchId: 'branch-1',
      ...testRole(role),
    }),
  } as unknown as jest.Mocked<WorkContextAuthorizationService>;

  const matrixAuth = {
    assertAllowed: jest.fn().mockImplementation(async (_org, roleId, _mod, action) => {
      assertReservationRoleAllowed(roleKeyOfTestRoleId(roleId), action);
    }),
  } as unknown as MatrixAuthorizationService;

  const audit = { recordReservationEvent: jest.fn() } as unknown as jest.Mocked<AuditEventRepositoryPort>;
  const outbox = { publish: jest.fn() } as unknown as jest.Mocked<OutboxEventRepositoryPort>;
  const transactionManager: jest.Mocked<TransactionManagerPort> = {
    run: jest.fn((work: any) => work(FAKE_TX)),
  };

  const handler = new ConfirmSaleRefundTransferHandler(
    reservations,
    saleResolutions,
    workContext,
    matrixAuth,
    audit,
    outbox,
    transactionManager,
  );

  return { handler, reservations, saleResolutions, matrixAuth, audit, outbox, transactionManager };
}

describe('ConfirmSaleRefundTransferHandler (C4, BR-RES-007)', () => {
  const transferredAt = new Date('2026-10-26T15:30:00Z');

  it('confirma la transferencia bancaria, actualiza a TRANSFERRED, audita y emite evento outbox', async () => {
    const record = buildRecord();
    const deps = buildDeps(record, 'GERENCIA');

    const result = await deps.handler.execute(
      new ConfirmSaleRefundTransferCommand(
        'res-1',
        'uid-gerente',
        'company-1',
        'branch-1',
        3,
        'VOUCHER-BCP-987654',
        transferredAt,
        'Devolucion via BCP efectuada',
      ),
    );

    expect(result.version).toBe(4);
    expect(deps.saleResolutions.confirmRefundTransfer).toHaveBeenCalledWith(
      {
        id: 'res-1',
        expectedVersion: 3,
        transferVoucher: 'VOUCHER-BCP-987654',
        transferredAt,
        transferredBy: 'uid-gerente',
        scope: {
          organizationId: 'org-1',
          operatingCompanyId: 'company-1',
          branchId: 'branch-1',
        },
      },
      FAKE_TX,
    );

    expect(deps.audit.recordReservationEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'SALE_REFUND_TRANSFERRED',
        changes: expect.objectContaining({
          transferVoucher: 'VOUCHER-BCP-987654',
          transferredAt: transferredAt.toISOString(),
          transferredBy: 'uid-gerente',
          refundStatus: 'TRANSFERRED',
        }),
      }),
      FAKE_TX,
    );

    expect(deps.outbox.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        aggregateType: 'reservation',
        eventType: 'ReservationSaleRefundTransferred.v1',
        payload: expect.objectContaining({
          reservationId: 'res-1',
          transferVoucher: 'VOUCHER-BCP-987654',
          refundStatus: 'TRANSFERRED',
        }),
      }),
      FAKE_TX,
    );
  });

  it('permite que FINANZAS confirme la transferencia bancaria', async () => {
    const record = buildRecord();
    const deps = buildDeps(record, 'FINANZAS');

    await deps.handler.execute(
      new ConfirmSaleRefundTransferCommand('res-1', 'uid-finanzas', 'company-1', 'branch-1', 3, 'VOUCHER-1', transferredAt),
    );

    expect(deps.saleResolutions.confirmRefundTransfer).toHaveBeenCalled();
  });

  it('rechaza con 403 ROLE_NOT_ALLOWED si el rol es FRONT_OFFICE', async () => {
    const record = buildRecord();
    const deps = buildDeps(record, 'FRONT_OFFICE');

    await expect(
      deps.handler.execute(
        new ConfirmSaleRefundTransferCommand('res-1', 'uid-operador', 'company-1', 'branch-1', 3, 'VOUCHER-1', transferredAt),
      ),
    ).rejects.toThrow(ForbiddenException);

    expect(deps.saleResolutions.confirmRefundTransfer).not.toHaveBeenCalled();
  });

  it('rechaza con 404 NotFoundException si la reserva no existe', async () => {
    const deps = buildDeps(null, 'GERENCIA');

    await expect(
      deps.handler.execute(
        new ConfirmSaleRefundTransferCommand('res-inexistente', 'uid-gerente', 'company-1', 'branch-1', 1, 'V-1', transferredAt),
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('rechaza con 409 si la reserva no está en estado CANCELLED', async () => {
    const record = buildRecord({ status: 'CONFIRMED' });
    const deps = buildDeps(record, 'GERENCIA');

    await expect(
      deps.handler.execute(
        new ConfirmSaleRefundTransferCommand('res-1', 'uid-gerente', 'company-1', 'branch-1', 3, 'V-1', transferredAt),
      ),
    ).rejects.toThrow(DomainConflictError);
  });
});
