import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { RegisterPaymentHandler } from './register-payment.handler';
import { RegisterPaymentCommand } from './register-payment.command';
import { ReservationRepositoryPort, ReservationRecord, ReservationScope } from '../ports/reservation-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { assertReservationRoleAllowed } from '../policies/reservation-role-policy';
import { ReservationDocumentRepositoryPort } from '../ports/reservation-document-repository.port';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import {
  InvalidDepositAmountError,
  PaymentProofRequiredError,
  PaymentVoucherNotFoundError,
  ReservationStateConflictError,
} from '../../domain/reservation-errors';
import { roleKeyOfTestRoleId, testRole } from '../../../users/testing/role-fixtures';

function buildRecord(overrides: Partial<ReservationRecord> = {}): ReservationRecord {
  return {
    id: 'res-1', organizationId: 'org-1', operatingCompanyId: 'company-1', branchId: 'branch-1',
    inquiryId: 'inq-1', customerId: 'cust-1', customerName: 'Maria Quispe', vehicleId: 'veh-1',
    vehiclePlate: 'D0Y-704', vehicleLabel: 'Toyota Hilux - D0Y-704', status: 'DRAFT',
    channelMode: 'PRESENCIAL', startAt: new Date(), endAt: new Date(), requiredPaymentAmount: '300.00',
    currency: 'PEN', paymentPolicyVersion: 1, paymentValidatedAt: null, documentsCompletedAt: null,
    confirmedAt: null, createdAt: new Date(), createdBy: 'uid-1', version: 1,
    ...overrides,
  };
}

const SCOPE: ReservationScope = { organizationId: 'org-1', operatingCompanyId: 'company-1', branchId: 'branch-1' };

const TX = { marker: 'tx' } as never;

describe('RegisterPaymentHandler', () => {
  function buildDeps(existing: ReservationRecord | null, forbidden = false, role = 'FRONT_OFFICE', matrixAssert?: jest.Mock) {
    const reservations: jest.Mocked<ReservationRepositoryPort> = {
      findCustomerById: jest.fn(), findVehicleById: jest.fn(), isVehicleAvailable: jest.fn(),
      create: jest.fn(), findById: jest.fn().mockResolvedValue(existing), list: jest.fn(),
      registerPayment: jest.fn().mockResolvedValue({ ...(existing ?? buildRecord()), paymentValidatedAt: new Date(), version: 2 }),
      registerDocuments: jest.fn(), confirm: jest.fn(), cancel: jest.fn(),
    } as unknown as jest.Mocked<ReservationRepositoryPort>;
    const documents = {
      record: jest.fn(), list: jest.fn(), countCustomerDocuments: jest.fn(),
      findById: jest.fn().mockResolvedValue({ id: 'doc-1', reservationId: 'res-1', documentType: 'PAYMENT_VOUCHER', objectUrl: 'gs://x', createdAt: new Date() }),
    } as unknown as jest.Mocked<ReservationDocumentRepositoryPort>;
    const workContext = {
      authorize: forbidden
        ? jest.fn().mockRejectedValue(new ForbiddenException())
        : jest.fn().mockResolvedValue({ organizationId: 'org-1', companyId: 'company-1', branchId: 'branch-1', ...testRole(role) }),
    } as unknown as jest.Mocked<WorkContextAuthorizationService>;
    const matrixAuth = {
      assertAllowed:
        matrixAssert ??
        jest.fn().mockImplementation(async (_orgId, r, _mod, action) => {
          assertReservationRoleAllowed(roleKeyOfTestRoleId(r), action);
        }),
      isAllowed: jest.fn().mockResolvedValue(true),
    } as unknown as MatrixAuthorizationService;
    const transactions = { run: jest.fn().mockImplementation(async (work: (t: never) => Promise<unknown>) => work(TX)) } as unknown as jest.Mocked<TransactionManagerPort>;
    const audit = { recordReservationEvent: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<AuditEventRepositoryPort>;
    const handler = new RegisterPaymentHandler(reservations, documents, workContext, matrixAuth, transactions, audit);
    return { handler, reservations, documents, workContext, matrixAuth, transactions, audit };
  }

  const pay = (overrides: { amount?: string; method?: any; operationNumber?: string | undefined; voucherDocumentId?: string | undefined; id?: string; company?: string; branch?: string } = {}) =>
    new RegisterPaymentCommand(
      overrides.id ?? 'res-1', 'uid-1', overrides.company ?? 'company-1', overrides.branch ?? 'branch-1', 1,
      overrides.amount ?? '300.00', overrides.method ?? 'TRANSFERENCIA', 'Maria Quispe',
      'operationNumber' in overrides ? overrides.operationNumber : 'OP-123',
      'voucherDocumentId' in overrides ? overrides.voucherDocumentId : 'doc-1',
    );

  it('registra el pago con comprobante en una transaccion, audita y marca payment_validated_at sin tocar disponibilidad', async () => {
    const { handler, reservations, audit, transactions } = buildDeps(buildRecord());
    const result = await handler.execute(pay());

    expect(transactions.run).toHaveBeenCalled();
    expect(reservations.registerPayment).toHaveBeenCalledWith(
      'res-1', SCOPE, 1,
      expect.objectContaining({ amount: '300.00', method: 'TRANSFERENCIA', operationNumber: 'OP-123', payerName: 'Maria Quispe', voucherDocumentId: 'doc-1', registeredBy: 'uid-1' }),
      TX,
    );
    expect(audit.recordReservationEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'RESERVATION_PAYMENT_REGISTERED' }), TX);
    expect(reservations.confirm).not.toHaveBeenCalled();
    expect(result.paymentValidatedAt).not.toBeNull();
  });

  it('busca la reserva por el scope completo (organizationId + operatingCompanyId + branchId), no solo por organizationId', async () => {
    const { handler, reservations } = buildDeps(buildRecord());
    await handler.execute(pay());
    expect(reservations.findById).toHaveBeenCalledWith('res-1', SCOPE);
  });

  it('monto pagado menor que el requerido por la politica -> 422 INVALID_DEPOSIT_AMOUNT (SC-RES-001.02)', async () => {
    const { handler, reservations } = buildDeps(buildRecord());
    await expect(handler.execute(pay({ amount: '299.99' }))).rejects.toBeInstanceOf(InvalidDepositAmountError);
    expect(reservations.registerPayment).not.toHaveBeenCalled();
  });

  it('monto pagado mayor que el requerido -> 422 INVALID_DEPOSIT_AMOUNT (no hay saldo a favor)', async () => {
    const { handler, reservations } = buildDeps(buildRecord());
    await expect(handler.execute(pay({ amount: '350.00' }))).rejects.toMatchObject({ code: 'INVALID_DEPOSIT_AMOUNT', httpStatus: 422 });
    expect(reservations.registerPayment).not.toHaveBeenCalled();
  });

  it('sin comprobante ni nº de operacion (transferencia) -> 422 PAYMENT_PROOF_REQUIRED', async () => {
    const { handler, reservations } = buildDeps(buildRecord());
    await expect(handler.execute(pay({ operationNumber: undefined, voucherDocumentId: undefined }))).rejects.toBeInstanceOf(PaymentProofRequiredError);
    expect(reservations.registerPayment).not.toHaveBeenCalled();
  });

  it('en EFECTIVO basta el nº de recibo', async () => {
    const { handler, reservations } = buildDeps(buildRecord());
    await handler.execute(pay({ method: 'EFECTIVO', operationNumber: 'REC-9', voucherDocumentId: undefined }));
    expect(reservations.registerPayment).toHaveBeenCalled();
  });

  it('el voucher debe ser un PAYMENT_VOUCHER de esta reserva -> si no, 422 PAYMENT_VOUCHER_NOT_FOUND', async () => {
    const { handler, documents, reservations } = buildDeps(buildRecord());
    documents.findById.mockResolvedValueOnce(null);
    await expect(handler.execute(pay())).rejects.toBeInstanceOf(PaymentVoucherNotFoundError);
    expect(reservations.registerPayment).not.toHaveBeenCalled();

    documents.findById.mockResolvedValueOnce({ id: 'doc-1', reservationId: 'res-1', documentType: 'ID_DOCUMENT', objectUrl: 'x', createdAt: new Date() });
    await expect(handler.execute(pay())).rejects.toBeInstanceOf(PaymentVoucherNotFoundError);
  });

  it('rechaza si la reserva no existe', async () => {
    const { handler } = buildDeps(null);
    await expect(handler.execute(pay({ id: 'res-x' }))).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rechaza si la asignacion no es vigente', async () => {
    const { handler } = buildDeps(buildRecord(), true);
    await expect(handler.execute(pay({ company: 'company-ajena', branch: 'branch-ajena' }))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rechaza si la reserva ya no esta en DRAFT (maquina de estados)', async () => {
    const { handler, reservations } = buildDeps(buildRecord({ status: 'CONFIRMED' }));
    await expect(handler.execute(pay())).rejects.toBeInstanceOf(ReservationStateConflictError);
    expect(reservations.registerPayment).not.toHaveBeenCalled();
  });

  // Hallazgo ALTO PR#6 ("falta autorizacion granular por rol/accion").
  it('rechaza registrar pago si el rol autorizado no esta en la matriz de Reserva', async () => {
    const { handler, reservations } = buildDeps(buildRecord(), false, 'RRHH');
    await expect(handler.execute(pay())).rejects.toBeInstanceOf(ForbiddenException);
    expect(reservations.registerPayment).not.toHaveBeenCalled();
  });

  it('rechaza registrar pago si la matriz personalizada versionada revoca REGISTER_PAYMENT', async () => {
    const matrixAssert = jest.fn().mockRejectedValue(
      new ForbiddenException({
        code: 'ROLE_NOT_ALLOWED',
        detail: 'El rol FRONT_OFFICE no tiene permiso para realizar la accion REGISTER_PAYMENT sobre una Reserva segun la matriz vigente (version 2).',
      }),
    );
    const { handler, reservations } = buildDeps(buildRecord(), false, 'FRONT_OFFICE', matrixAssert);

    await expect(handler.execute(pay())).rejects.toMatchObject({ response: { code: 'ROLE_NOT_ALLOWED' } });
    expect(reservations.registerPayment).not.toHaveBeenCalled();
  });
});
