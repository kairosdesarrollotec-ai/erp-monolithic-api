import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { SaveNotificationTemplateHandler } from './save-notification-template.handler';
import { SaveNotificationTemplateCommand } from './save-notification-template.command';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { NotificationTemplatePort } from '../../../notification-templates/application/ports/notification-template.port';
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

  const templates: jest.Mocked<NotificationTemplatePort> = {
    getCurrent: jest.fn().mockResolvedValue({ eventType: 'ReservationConfirmed', version: 1, channels: ['EMAIL'], body: 'Hola {nombre}' }),
    listHistory: jest.fn(),
    createVersion: jest.fn().mockResolvedValue({ eventType: 'ReservationConfirmed', version: 2, channels: ['EMAIL', 'PUSH'], body: 'Hola {nombre}, tu reserva para {fecha} esta confirmada' }),
  };

  const audit: jest.Mocked<AuditEventRepositoryPort> = {
    recordLoginAttempt: jest.fn(),
    recordWorkContextSelection: jest.fn(),
    recordReservationEvent: jest.fn(),
    recordInquiryEvent: jest.fn(),
    recordAdminEvent: jest.fn(),
    recordRentalEvent: jest.fn(),
  };

  const transactionManager: jest.Mocked<TransactionManagerPort> = {
    run: jest.fn((work: any) => work(FAKE_TX)),
  };

  return { workContext, adminAuthorization, templates, audit, transactionManager };
}

function buildCommand(overrides: Partial<{ eventType: string; channels: ('EMAIL' | 'PUSH' | 'SMS')[]; body: string }> = {}) {
  return new SaveNotificationTemplateCommand(
    'uid-admin',
    'company-1',
    'branch-1',
    overrides.eventType ?? 'ReservationConfirmed',
    overrides.channels ?? ['EMAIL', 'PUSH'],
    overrides.body ?? 'Hola {nombre}, tu reserva para {fecha} esta confirmada',
  );
}

describe('SaveNotificationTemplateHandler', () => {
  it('crea una version nueva (nunca edita la anterior) y audita el cambio en la misma transaccion', async () => {
    const { workContext, adminAuthorization, templates, audit, transactionManager } = buildDeps();
    const handler = new SaveNotificationTemplateHandler(workContext, adminAuthorization, templates, audit, transactionManager);

    const result = await handler.execute(buildCommand());

    expect(templates.createVersion).toHaveBeenCalledWith(
      'org-1',
      { eventType: 'ReservationConfirmed', channels: ['EMAIL', 'PUSH'], body: 'Hola {nombre}, tu reserva para {fecha} esta confirmada' },
      'uid-admin',
      FAKE_TX,
    );
    expect(audit.recordAdminEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        actorUserId: 'uid-admin',
        action: 'NOTIFICATION_TEMPLATE_UPDATED',
        changes: expect.objectContaining({ eventType: 'ReservationConfirmed', previousVersion: 1, newVersion: 2 }),
      }),
      FAKE_TX,
    );
    expect(result.version).toBe(2);
  });

  it('rechaza cuando el rol autorizado no es ADMINISTRACION', async () => {
    const { workContext, adminAuthorization, templates, audit, transactionManager } = buildDeps('FRONT_OFFICE');
    const handler = new SaveNotificationTemplateHandler(workContext, adminAuthorization, templates, audit, transactionManager);

    await expect(handler.execute(buildCommand())).rejects.toBeInstanceOf(ForbiddenException);
    expect(templates.createVersion).not.toHaveBeenCalled();
  });

  it('rechaza un evento que no esta en el catalogo', async () => {
    const { workContext, adminAuthorization, templates, audit, transactionManager } = buildDeps();
    const handler = new SaveNotificationTemplateHandler(workContext, adminAuthorization, templates, audit, transactionManager);

    await expect(handler.execute(buildCommand({ eventType: 'EventoInventado' }))).rejects.toBeInstanceOf(BadRequestException);
    expect(templates.createVersion).not.toHaveBeenCalled();
  });

  it('rechaza cuando no hay ningun canal seleccionado', async () => {
    const { workContext, adminAuthorization, templates, audit, transactionManager } = buildDeps();
    const handler = new SaveNotificationTemplateHandler(workContext, adminAuthorization, templates, audit, transactionManager);

    await expect(handler.execute(buildCommand({ channels: [] }))).rejects.toBeInstanceOf(BadRequestException);
    expect(templates.createVersion).not.toHaveBeenCalled();
  });

  it('rechaza una variable no permitida (dato sensible)', async () => {
    const { workContext, adminAuthorization, templates, audit, transactionManager } = buildDeps();
    const handler = new SaveNotificationTemplateHandler(workContext, adminAuthorization, templates, audit, transactionManager);

    await expect(
      handler.execute(buildCommand({ body: 'Hola {nombre}, tu documento es {dni_completo}' })),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(templates.createVersion).not.toHaveBeenCalled();
  });
});
