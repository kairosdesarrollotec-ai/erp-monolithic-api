import { ForbiddenException } from '@nestjs/common';
import { GetDashboardHandler } from './get-dashboard.handler';
import { GetDashboardQuery } from './get-dashboard.query';
import { WorkContextAuthorizationService } from '../services/work-context-authorization.service';
import type { WorkerRole } from '../../domain/worker-role';

describe('GetDashboardHandler', () => {
  function buildAuthorization(
    context:
      | { organizationId: string; companyId: string; branchId: string; role: WorkerRole }
      | Error,
  ) {
    const authorization: jest.Mocked<Pick<WorkContextAuthorizationService, 'authorize'>> = {
      authorize:
        context instanceof Error
          ? jest.fn().mockRejectedValue(context)
          : jest.fn().mockResolvedValue(context),
    };
    return authorization as unknown as WorkContextAuthorizationService;
  }

  // Hallazgo alto de revision PR#5 ("el rol se usa para presentacion, no
  // para autorizacion"): el handler debe delegar la autorizacion en
  // WorkContextAuthorizationService - nunca resolver el rol el mismo ni
  // confiar en un rol enviado por el cliente.
  it.each<WorkerRole>([
    'ADMINISTRACION',
    'AUDITORIA',
    'CAMPO',
    'FINANZAS',
    'FRONT_OFFICE',
    'GERENCIA',
    'RRHH',
  ])('devuelve el rol %s resuelto por la autorizacion y estado EMPTY', async (role) => {
    const authorization = buildAuthorization({
      organizationId: 'org-1',
      companyId: 'company-1',
      branchId: 'branch-1',
      role,
    });
    const handler = new GetDashboardHandler(authorization);

    const result = await handler.execute(new GetDashboardQuery('uid-1', 'company-1', 'branch-1'));

    expect(authorization.authorize).toHaveBeenCalledWith({
      firebaseUid: 'uid-1',
      companyId: 'company-1',
      branchId: 'branch-1',
    });
    expect(result).toEqual({ role, state: 'EMPTY' });
  });

  it('propaga el 403 de la autorizacion cuando la combinacion no es una asignacion vigente del usuario (revocada, caducada o cross-company/cross-branch)', async () => {
    const authorization = buildAuthorization(
      new ForbiddenException(
        'La combinacion empresa/sede no es una asignacion vigente para este usuario.',
      ),
    );
    const handler = new GetDashboardHandler(authorization);

    await expect(
      handler.execute(new GetDashboardQuery('uid-1', 'company-ajena', 'branch-ajena')),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
