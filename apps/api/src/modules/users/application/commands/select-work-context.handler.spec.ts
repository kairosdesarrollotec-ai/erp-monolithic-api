import { ForbiddenException } from '@nestjs/common';
import { SelectWorkContextHandler } from './select-work-context.handler';
import { SelectWorkContextCommand } from './select-work-context.command';
import { WorkContextAuthorizationService } from '../services/work-context-authorization.service';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';

describe('SelectWorkContextHandler', () => {
  // TransactionManagerPort.run ejecuta el trabajo con un "tx" fake -
  // suficiente para probar que el handler orquesta autorizacion + auditoria
  // dentro de la misma transaccion, sin necesitar un Prisma real.
  const fakeTx = { __fakeTransactionClient: true } as never;

  function buildDeps(authorizedContext: { organizationId: string; companyId: string; branchId: string } | Error) {
    const authorization: jest.Mocked<Pick<WorkContextAuthorizationService, 'authorize'>> = {
      authorize:
        authorizedContext instanceof Error
          ? jest.fn().mockRejectedValue(authorizedContext)
          : jest.fn().mockResolvedValue(authorizedContext),
    };
    const auditRepository: jest.Mocked<AuditEventRepositoryPort> = {
      recordLoginAttempt: jest.fn(),
      recordWorkContextSelection: jest.fn().mockResolvedValue(undefined),
      recordReservationEvent: jest.fn().mockResolvedValue(undefined),
      recordInquiryEvent: jest.fn().mockResolvedValue(undefined),
      recordAdminEvent: jest.fn().mockResolvedValue(undefined),
    };
    const runMock = jest.fn((work: (tx: never) => Promise<unknown>) => work(fakeTx));
    const transactionManager: TransactionManagerPort = {
      run: runMock as unknown as TransactionManagerPort['run'],
    };
    return {
      authorization: authorization as unknown as WorkContextAuthorizationService,
      auditRepository,
      transactionManager,
      runMock,
    };
  }

  it('autoriza y registra el evento de auditoria dentro de la misma transaccion cuando la asignacion es valida', async () => {
    const { authorization, auditRepository, transactionManager, runMock } = buildDeps({
      organizationId: 'org-1',
      companyId: 'company-1',
      branchId: 'branch-1',
    });
    const handler = new SelectWorkContextHandler(authorization, auditRepository, transactionManager);

    await handler.execute(new SelectWorkContextCommand('uid-1', 'company-1', 'branch-1'));

    expect(runMock).toHaveBeenCalledTimes(1);
    expect(authorization.authorize).toHaveBeenCalledWith(
      { firebaseUid: 'uid-1', companyId: 'company-1', branchId: 'branch-1' },
      fakeTx,
    );
    expect(auditRepository.recordWorkContextSelection).toHaveBeenCalledWith(
      {
        organizationId: 'org-1',
        firebaseUid: 'uid-1',
        companyId: 'company-1',
        branchId: 'branch-1',
      },
      fakeTx,
    );
  });

  it('rechaza y no audita si la combinacion no es una asignacion vigente del usuario', async () => {
    const { authorization, auditRepository, transactionManager } = buildDeps(
      new ForbiddenException('La combinacion empresa/sede no es una asignacion vigente para este usuario.'),
    );
    const handler = new SelectWorkContextHandler(authorization, auditRepository, transactionManager);

    await expect(
      handler.execute(new SelectWorkContextCommand('uid-1', 'company-ajena', 'branch-ajena')),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(auditRepository.recordWorkContextSelection).not.toHaveBeenCalled();
  });
});
