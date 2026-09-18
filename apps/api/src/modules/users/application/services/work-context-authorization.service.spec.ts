import { ForbiddenException } from '@nestjs/common';
import { WorkContextAuthorizationService } from './work-context-authorization.service';
import { WorkContextRepositoryPort } from '../ports/work-context-repository.port';

describe('WorkContextAuthorizationService', () => {
  function buildRepository(assignment: { organizationId: string } | null) {
    const repository: jest.Mocked<WorkContextRepositoryPort> = {
      findAssignmentsByFirebaseUid: jest.fn(),
      findValidAssignment: jest.fn().mockResolvedValue(assignment),
    };
    return repository;
  }

  it('devuelve un AuthorizedWorkContext cuando la asignacion es valida y vigente', async () => {
    const repository = buildRepository({ organizationId: 'org-1' });
    const service = new WorkContextAuthorizationService(repository);

    const result = await service.authorize({
      firebaseUid: 'uid-1',
      companyId: 'company-1',
      branchId: 'branch-1',
    });

    expect(result).toEqual({ organizationId: 'org-1', companyId: 'company-1', branchId: 'branch-1' });
    expect(repository.findValidAssignment).toHaveBeenCalledWith(
      { firebaseUid: 'uid-1', companyId: 'company-1', branchId: 'branch-1' },
      undefined,
    );
  });

  it('propaga el cliente de transaccion opcional al puerto de repositorio', async () => {
    const repository = buildRepository({ organizationId: 'org-1' });
    const service = new WorkContextAuthorizationService(repository);
    const fakeTx = { __fakeTransactionClient: true } as never;

    await service.authorize({ firebaseUid: 'uid-1', companyId: 'company-1', branchId: 'branch-1' }, fakeTx);

    expect(repository.findValidAssignment).toHaveBeenCalledWith(
      { firebaseUid: 'uid-1', companyId: 'company-1', branchId: 'branch-1' },
      fakeTx,
    );
  });

  it('deniega por defecto (ForbiddenException) cuando no hay asignacion vigente para esa combinacion', async () => {
    const repository = buildRepository(null);
    const service = new WorkContextAuthorizationService(repository);

    await expect(
      service.authorize({ firebaseUid: 'uid-1', companyId: 'company-ajena', branchId: 'branch-ajena' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
