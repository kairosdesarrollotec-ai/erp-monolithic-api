import { ForbiddenException } from '@nestjs/common';
import { GetNotificationTemplatesHandler } from './get-notification-templates.handler';
import { GetNotificationTemplatesQuery } from './get-notification-templates.query';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { NotificationTemplatePort } from '../../../notification-templates/application/ports/notification-template.port';
import { AdminMatrixAuthorizationService } from '../services/admin-matrix-authorization.service';
import type { WorkerRole } from '../../../users/domain/worker-role';

function buildAuthorization(role: WorkerRole = 'ADMINISTRACION') {
  return {
    authorize: jest.fn().mockResolvedValue({ organizationId: 'org-1', companyId: 'company-1', branchId: 'branch-1', role }),
  } as unknown as WorkContextAuthorizationService;
}

function buildAdminAuthorization(allowed = true) {
  return {
    assertAllowed: jest.fn().mockImplementation(async () => {
      if (!allowed) throw new ForbiddenException();
    }),
  } as unknown as AdminMatrixAuthorizationService;
}

function buildTemplates() {
  const port: jest.Mocked<NotificationTemplatePort> = {
    getCurrent: jest.fn().mockResolvedValue(null),
    listHistory: jest.fn().mockResolvedValue([]),
    createVersion: jest.fn(),
  };
  return port;
}

describe('GetNotificationTemplatesHandler', () => {
  it('devuelve una entrada por cada evento del catalogo, con la plantilla vigente (o null) y su historial', async () => {
    const authorization = buildAuthorization();
    const templates = buildTemplates();
    const handler = new GetNotificationTemplatesHandler(authorization, buildAdminAuthorization(true), templates);

    const result = await handler.execute(new GetNotificationTemplatesQuery('uid-admin', 'company-1', 'branch-1'));

    expect(result.templates.length).toBeGreaterThan(0);
    expect(result.templates.every((t) => t.current === null)).toBe(true);
    expect(result.allowedVariables).toContain('nombre');
    expect(result.channels).toContain('EMAIL');
  });

  it('rechaza cuando el rol autorizado no es ADMINISTRACION', async () => {
    const authorization = buildAuthorization('FRONT_OFFICE');
    const handler = new GetNotificationTemplatesHandler(authorization, buildAdminAuthorization(false), buildTemplates());

    await expect(
      handler.execute(new GetNotificationTemplatesQuery('uid-1', 'company-1', 'branch-1')),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
