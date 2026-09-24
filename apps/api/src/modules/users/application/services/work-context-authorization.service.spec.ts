import { ForbiddenException } from '@nestjs/common';
import { WorkContextAuthorizationService } from './work-context-authorization.service';
import { WorkContextRepositoryPort } from '../ports/work-context-repository.port';

describe('WorkContextAuthorizationService', () => {
  function buildRepository(assignment: { organizationId: string; role: string } | null) {
    const repository: jest.Mocked<WorkContextRepositoryPort> = {
      findAssignmentsByFirebaseUid: jest.fn(),
      findValidAssignment: jest.fn().mockResolvedValue(assignment),
    };
    return repository;
  }

  it('devuelve un AuthorizedWorkContext (incluye el rol) cuando la asignacion es valida y vigente', async () => {
    const repository = buildRepository({ organizationId: 'org-1', role: 'GERENCIA' });
    const service = new WorkContextAuthorizationService(repository);

    const result = await service.authorize({
      firebaseUid: 'uid-1',
      companyId: 'company-1',
      branchId: 'branch-1',
    });

    expect(result).toEqual({
      organizationId: 'org-1',
      companyId: 'company-1',
      branchId: 'branch-1',
      role: 'GERENCIA',
    });
    expect(repository.findValidAssignment).toHaveBeenCalledWith(
      { firebaseUid: 'uid-1', companyId: 'company-1', branchId: 'branch-1' },
      undefined,
    );
  });

  it('propaga el cliente de transaccion opcional al puerto de repositorio', async () => {
    const repository = buildRepository({ organizationId: 'org-1', role: 'GERENCIA' });
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

  it('deniega por defecto cuando la asignacion existe pero esta revocada o caducada (repositorio ya la excluye por vigencia)', async () => {
    // El filtro de vigencia (active/validFrom/validUntil) vive en el
    // repositorio (hallazgo alto de revision PR#4/PR#5); este caso
    // documenta que el servicio de autorizacion deniega igual que con
    // cualquier otra combinacion sin asignacion vigente, sin necesitar
    // conocer el motivo (revocada, caducada, o simplemente inexistente).
    const repository = buildRepository(null);
    const service = new WorkContextAuthorizationService(repository);

    await expect(
      service.authorize({ firebaseUid: 'uid-1', companyId: 'company-1', branchId: 'branch-1' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
