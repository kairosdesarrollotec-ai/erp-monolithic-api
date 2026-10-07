import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { UpdateReservationDepositPolicyHandler } from './update-reservation-deposit-policy.handler';
import { UpdateReservationDepositPolicyCommand } from './update-reservation-deposit-policy.command';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { ReservationDepositPolicyPort } from '../../../parameters/application/ports/reservation-deposit-policy.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AdminMatrixAuthorizationService } from '../services/admin-matrix-authorization.service';
import type { WorkerRole } from '../../../users/domain/worker-role';

const FAKE_TX = { __fakeTx: true } as any;

function buildDeps(role: WorkerRole = 'ADMINISTRACION') {
  const workContext = {
    authorize: jest.fn().mockResolvedValue({ organizationId: 'org-1', companyId: 'company-1', branchId: 'branch-1', role }),
  } as unknown as jest.Mocked<WorkContextAuthorizationService>;

  const adminAuthorization: jest.Mocked<AdminMatrixAuthorizationService> = {
    assertAllowed: jest.fn().mockImplementation(async () => {
      if (role !== 'ADMINISTRACION') throw new ForbiddenException();
    }),
  } as any;

  const depositPolicy: jest.Mocked<ReservationDepositPolicyPort> = {
    getCurrent: jest.fn().mockResolvedValue({ version: 1, amount: '300.00', currency: 'PEN', effectiveFrom: null }),
    listHistory: jest.fn(),
    createVersion: jest.fn().mockResolvedValue({ version: 2, amount: '350.00', currency: 'PEN', effectiveFrom: new Date('2026-09-23T00:00:00Z') }),
  };

  const audit: jest.Mocked<AuditEventRepositoryPort> = {
    recordLoginAttempt: jest.fn(),
    recordWorkContextSelection: jest.fn(),
    recordReservationEvent: jest.fn(),
    recordInquiryEvent: jest.fn(),
    recordAdminEvent: jest.fn(),
    recordRentalEvent: jest.fn(),
    recordIncidentEvent: jest.fn(),
  };

  const transactionManager: jest.Mocked<TransactionManagerPort> = {
    run: jest.fn((work: any) => work(FAKE_TX)),
  };

  return { workContext, adminAuthorization, depositPolicy, audit, transactionManager };
}

function buildCommand(overrides: Partial<{ amount: string; currency: string }> = {}) {
  return new UpdateReservationDepositPolicyCommand(
    'uid-admin',
    'company-1',
    'branch-1',
    overrides.amount ?? '350.00',
    overrides.currency ?? 'PEN',
  );
}

describe('UpdateReservationDepositPolicyHandler', () => {
  it('crea una version nueva (nunca edita la anterior) y audita el cambio en la misma transaccion', async () => {
    const { workContext, adminAuthorization, depositPolicy, audit, transactionManager } = buildDeps();
    const handler = new UpdateReservationDepositPolicyHandler(workContext, adminAuthorization, depositPolicy, audit, transactionManager);

    const result = await handler.execute(buildCommand());

    expect(depositPolicy.createVersion).toHaveBeenCalledWith(
      { organizationId: 'org-1', amount: '350.00', currency: 'PEN', createdBy: 'uid-admin' },
      FAKE_TX,
    );
    expect(audit.recordAdminEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        actorUserId: 'uid-admin',
        action: 'RESERVATION_DEPOSIT_POLICY_UPDATED',
        changes: expect.objectContaining({ previousVersion: 1, newVersion: 2, newAmount: '350.00' }),
      }),
      FAKE_TX,
    );
    expect(result.version).toBe(2);
  });

  it('rechaza cuando el rol autorizado no es ADMINISTRACION', async () => {
    const { workContext, adminAuthorization, depositPolicy, audit, transactionManager } = buildDeps('FRONT_OFFICE');
    const handler = new UpdateReservationDepositPolicyHandler(workContext, adminAuthorization, depositPolicy, audit, transactionManager);

    await expect(handler.execute(buildCommand())).rejects.toBeInstanceOf(ForbiddenException);
    expect(depositPolicy.createVersion).not.toHaveBeenCalled();
  });

  it('rechaza un monto no positivo', async () => {
    const { workContext, adminAuthorization, depositPolicy, audit, transactionManager } = buildDeps();
    const handler = new UpdateReservationDepositPolicyHandler(workContext, adminAuthorization, depositPolicy, audit, transactionManager);

    await expect(handler.execute(buildCommand({ amount: '0' }))).rejects.toBeInstanceOf(BadRequestException);
    await expect(handler.execute(buildCommand({ amount: '-10' }))).rejects.toBeInstanceOf(BadRequestException);
    expect(depositPolicy.createVersion).not.toHaveBeenCalled();
  });
});
