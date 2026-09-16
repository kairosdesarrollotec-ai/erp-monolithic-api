import { ForbiddenException } from '@nestjs/common';
import { GetDashboardHandler } from './get-dashboard.handler';
import { GetDashboardQuery } from './get-dashboard.query';
import { WorkContextRepositoryPort } from '../ports/work-context-repository.port';

describe('GetDashboardHandler', () => {
  function buildRepository(assignment: { organizationId: string; role: string } | null) {
    const repository: jest.Mocked<WorkContextRepositoryPort> = {
      findAssignmentsByFirebaseUid: jest.fn(),
      findValidAssignment: jest.fn().mockResolvedValue(assignment),
    };
    return repository;
  }

  it('devuelve el rol resuelto y estado EMPTY cuando la asignacion es valida', async () => {
    const repository = buildRepository({ organizationId: 'org-1', role: 'GERENCIA' as any });
    const handler = new GetDashboardHandler(repository);

    const result = await handler.execute(new GetDashboardQuery('uid-1', 'company-1', 'branch-1'));

    expect(repository.findValidAssignment).toHaveBeenCalledWith({
      firebaseUid: 'uid-1',
      companyId: 'company-1',
      branchId: 'branch-1',
    });
    expect(result).toEqual({ role: 'GERENCIA', state: 'EMPTY' });
  });

  it('rechaza si la combinacion no es una asignacion vigente del usuario', async () => {
    const repository = buildRepository(null);
    const handler = new GetDashboardHandler(repository);

    await expect(
      handler.execute(new GetDashboardQuery('uid-1', 'company-ajena', 'branch-ajena')),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
