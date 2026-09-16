import { ForbiddenException } from '@nestjs/common';
import { SelectWorkContextHandler } from './select-work-context.handler';
import { SelectWorkContextCommand } from './select-work-context.command';
import { WorkContextRepositoryPort } from '../ports/work-context-repository.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';

describe('SelectWorkContextHandler', () => {
  function buildRepositories(assignment: { organizationId: string } | null) {
    const workContextRepository: jest.Mocked<WorkContextRepositoryPort> = {
      findAssignmentsByFirebaseUid: jest.fn(),
      findValidAssignment: jest.fn().mockResolvedValue(assignment),
    };
    const auditRepository: jest.Mocked<AuditEventRepositoryPort> = {
      recordLoginAttempt: jest.fn(),
      recordWorkContextSelection: jest.fn().mockResolvedValue(undefined),
    };
    return { workContextRepository, auditRepository };
  }

  it('registra el evento de auditoria cuando la asignacion es valida', async () => {
    const { workContextRepository, auditRepository } = buildRepositories({
      organizationId: 'org-1',
    });
    const handler = new SelectWorkContextHandler(workContextRepository, auditRepository);

    await handler.execute(new SelectWorkContextCommand('uid-1', 'company-1', 'branch-1'));

    expect(workContextRepository.findValidAssignment).toHaveBeenCalledWith({
      firebaseUid: 'uid-1',
      companyId: 'company-1',
      branchId: 'branch-1',
    });
    expect(auditRepository.recordWorkContextSelection).toHaveBeenCalledWith({
      organizationId: 'org-1',
      firebaseUid: 'uid-1',
      companyId: 'company-1',
      branchId: 'branch-1',
    });
  });

  it('rechaza y no audita si la combinacion no es una asignacion vigente del usuario', async () => {
    const { workContextRepository, auditRepository } = buildRepositories(null);
    const handler = new SelectWorkContextHandler(workContextRepository, auditRepository);

    await expect(
      handler.execute(new SelectWorkContextCommand('uid-1', 'company-ajena', 'branch-ajena')),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(auditRepository.recordWorkContextSelection).not.toHaveBeenCalled();
  });
});
