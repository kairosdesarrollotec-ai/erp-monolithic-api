import { ForbiddenException } from '@nestjs/common';
import { GetDashboardHandler } from './get-dashboard.handler';
import { GetDashboardQuery } from './get-dashboard.query';
import { WorkContextAuthorizationService } from '../services/work-context-authorization.service';
import type { WorkerRole } from '../../domain/worker-role';
import { DashboardItemRepositoryPort, DashboardItemRecord } from '../../../dashboard-projections/application/ports/dashboard-item-repository.port';
import { testRole } from '../../testing/role-fixtures';

describe('GetDashboardHandler', () => {
  function buildAuthorization(
    context:
      | { organizationId: string; companyId: string; branchId: string; roleId: string; roleName: string; roleKey: WorkerRole | null }
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

  function buildDashboardItems(items: DashboardItemRecord[] = []) {
    const repo: jest.Mocked<DashboardItemRepositoryPort> = {
      upsertFromEvent: jest.fn(),
      dismissBySource: jest.fn(),
      listActive: jest.fn().mockResolvedValue(items),
    };
    return repo;
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
      ...testRole(role),
    });
    const dashboardItems = buildDashboardItems([]);
    const handler = new GetDashboardHandler(authorization, dashboardItems);

    const result = await handler.execute(new GetDashboardQuery('uid-1', 'company-1', 'branch-1'));

    expect(authorization.authorize).toHaveBeenCalledWith({
      firebaseUid: 'uid-1',
      companyId: 'company-1',
      branchId: 'branch-1',
    });
    expect(dashboardItems.listActive).toHaveBeenCalledWith({
      organizationId: 'org-1',
      operatingCompanyId: 'company-1',
      branchId: 'branch-1',
      role,
    });
    expect(result).toEqual({ role: { id: `role-${role}`, name: role, key: role }, state: 'EMPTY' });
  });

  it('propaga el 403 de la autorizacion cuando la combinacion no es una asignacion vigente del usuario (revocada, caducada o cross-company/cross-branch)', async () => {
    const authorization = buildAuthorization(
      new ForbiddenException(
        'La combinacion empresa/sede no es una asignacion vigente para este usuario.',
      ),
    );
    const handler = new GetDashboardHandler(authorization, buildDashboardItems([]));

    await expect(
      handler.execute(new GetDashboardQuery('uid-1', 'company-ajena', 'branch-ajena')),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('devuelve READY con las tareas activas del rol cuando la proyeccion tiene items (HU-24, extension 23 sep 2026)', async () => {
    const authorization = buildAuthorization({
      organizationId: 'org-1',
      companyId: 'company-1',
      branchId: 'branch-1',
      ...testRole('FRONT_OFFICE'),
    });
    const dashboardItems = buildDashboardItems([
      {
        id: 'item-1',
        itemType: 'TASK',
        priority: 10,
        title: 'Reserva pendiente de pago/documentos',
        detail: 'Vehiculo veh-1',
        deepLink: '/reservations/res-1',
        sourceType: 'RESERVATION',
        sourceId: 'res-1',
        createdAt: new Date('2026-09-23T10:00:00Z'),
      },
    ]);
    const handler = new GetDashboardHandler(authorization, dashboardItems);

    const result = await handler.execute(new GetDashboardQuery('uid-1', 'company-1', 'branch-1'));

    expect(result).toEqual({
      role: { id: 'role-FRONT_OFFICE', name: 'FRONT_OFFICE', key: 'FRONT_OFFICE' },
      state: 'READY',
      tasks: [
        {
          id: 'item-1',
          itemType: 'TASK',
          priority: 10,
          title: 'Reserva pendiente de pago/documentos',
          detail: 'Vehiculo veh-1',
          deepLink: '/reservations/res-1',
        },
      ],
    });
  });
});
