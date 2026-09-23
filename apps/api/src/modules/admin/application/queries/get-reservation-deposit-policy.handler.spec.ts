import { ForbiddenException } from '@nestjs/common';
import { GetReservationDepositPolicyHandler } from './get-reservation-deposit-policy.handler';
import { GetReservationDepositPolicyQuery } from './get-reservation-deposit-policy.query';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { ReservationDepositPolicyPort } from '../../../parameters/application/ports/reservation-deposit-policy.port';
import type { WorkerRole } from '../../../users/domain/worker-role';

function buildAuthorization(role: WorkerRole = 'ADMINISTRACION', rejects?: Error) {
  return {
    authorize: rejects
      ? jest.fn().mockRejectedValue(rejects)
      : jest.fn().mockResolvedValue({ organizationId: 'org-1', companyId: 'company-1', branchId: 'branch-1', role }),
  } as unknown as WorkContextAuthorizationService;
}

function buildDepositPolicy() {
  const port: jest.Mocked<ReservationDepositPolicyPort> = {
    getCurrent: jest.fn().mockResolvedValue({ version: 2, amount: '350.00', currency: 'PEN', effectiveFrom: new Date('2026-09-20T00:00:00Z') }),
    listHistory: jest.fn().mockResolvedValue([
      { version: 2, amount: '350.00', currency: 'PEN', effectiveFrom: new Date('2026-09-20T00:00:00Z') },
      { version: 1, amount: '300.00', currency: 'PEN', effectiveFrom: null },
    ]),
    createVersion: jest.fn(),
  };
  return port;
}

describe('GetReservationDepositPolicyHandler', () => {
  it('devuelve la version vigente y el historial completo', async () => {
    const authorization = buildAuthorization();
    const depositPolicy = buildDepositPolicy();
    const handler = new GetReservationDepositPolicyHandler(authorization, depositPolicy);

    const result = await handler.execute(new GetReservationDepositPolicyQuery('uid-admin', 'company-1', 'branch-1'));

    expect(depositPolicy.getCurrent).toHaveBeenCalledWith('org-1');
    expect(depositPolicy.listHistory).toHaveBeenCalledWith('org-1');
    expect(result.current).toEqual({ version: 2, amount: '350.00', currency: 'PEN', effectiveFrom: '2026-09-20T00:00:00.000Z' });
    expect(result.history).toHaveLength(2);
    expect(result.history[1].effectiveFrom).toBeNull();
  });

  it('rechaza cuando el rol autorizado no es ADMINISTRACION', async () => {
    const authorization = buildAuthorization('FRONT_OFFICE');
    const handler = new GetReservationDepositPolicyHandler(authorization, buildDepositPolicy());

    await expect(
      handler.execute(new GetReservationDepositPolicyQuery('uid-1', 'company-1', 'branch-1')),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
