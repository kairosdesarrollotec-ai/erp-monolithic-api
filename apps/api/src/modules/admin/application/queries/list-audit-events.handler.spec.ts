import { ForbiddenException } from '@nestjs/common';
import { ListAuditEventsHandler } from './list-audit-events.handler';
import { ListAuditEventsQuery } from './list-audit-events.query';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { AuditEventQueryPort, AuditEventRecord } from '../../../audit/application/ports/audit-event-query.port';
import { IdentityLookupPort } from '../ports/identity-lookup.port';
import type { WorkerRole } from '../../../users/domain/worker-role';

function buildAuthorization(role: WorkerRole = 'ADMINISTRACION', rejects?: Error) {
  return {
    authorize: rejects
      ? jest.fn().mockRejectedValue(rejects)
      : jest.fn().mockResolvedValue({ organizationId: 'org-1', companyId: 'company-1', branchId: 'branch-1', role }),
  } as unknown as WorkContextAuthorizationService;
}

function buildAuditEvents(records: AuditEventRecord[] = []) {
  const repo: jest.Mocked<AuditEventQueryPort> = {
    listEvents: jest.fn().mockResolvedValue(records),
  };
  return repo;
}

function buildIdentity(emails: Record<string, string | null> = {}) {
  const repo: jest.Mocked<IdentityLookupPort> = {
    findUidByEmail: jest.fn(),
    findEmailsByUids: jest.fn().mockResolvedValue(emails),
  };
  return repo;
}

describe('ListAuditEventsHandler', () => {
  it('lista los eventos de auditoria de la organizacion con el correo del actor resuelto', async () => {
    const authorization = buildAuthorization();
    const record: AuditEventRecord = {
      id: 'event-1',
      organizationId: 'org-1',
      actorUserId: 'uid-1',
      entityType: 'admin_user_assignment',
      entityId: 'uid-target',
      action: 'USER_ASSIGNMENT_CREATED_OR_REACTIVATED',
      changes: { targetEmail: 'nuevo@veloxrent.pe' },
      createdAt: new Date('2026-09-23T12:00:00Z'),
    };
    const auditEvents = buildAuditEvents([record]);
    const identity = buildIdentity({ 'uid-1': 'admin@veloxrent.pe' });
    const handler = new ListAuditEventsHandler(authorization, auditEvents, identity);

    const result = await handler.execute(new ListAuditEventsQuery('uid-admin', 'company-1', 'branch-1'));

    expect(auditEvents.listEvents).toHaveBeenCalledWith({
      organizationId: 'org-1',
      actorUserId: undefined,
      entityType: undefined,
      dateFrom: undefined,
      dateTo: undefined,
    });
    expect(identity.findEmailsByUids).toHaveBeenCalledWith(['uid-1']);
    expect(result).toEqual([
      {
        id: 'event-1',
        actorFirebaseUid: 'uid-1',
        actorEmail: 'admin@veloxrent.pe',
        entityType: 'admin_user_assignment',
        entityId: 'uid-target',
        action: 'USER_ASSIGNMENT_CREATED_OR_REACTIVATED',
        changes: { targetEmail: 'nuevo@veloxrent.pe' },
        createdAt: '2026-09-23T12:00:00.000Z',
      },
    ]);
  });

  it('pasa los filtros opcionales (actor, tipo, rango de fechas) al puerto de lectura', async () => {
    const authorization = buildAuthorization();
    const auditEvents = buildAuditEvents([]);
    const identity = buildIdentity();
    const handler = new ListAuditEventsHandler(authorization, auditEvents, identity);

    await handler.execute(
      new ListAuditEventsQuery(
        'uid-admin',
        'company-1',
        'branch-1',
        'uid-target',
        'reservation',
        '2026-09-01T00:00:00Z',
        '2026-09-30T23:59:59Z',
      ),
    );

    expect(auditEvents.listEvents).toHaveBeenCalledWith({
      organizationId: 'org-1',
      actorUserId: 'uid-target',
      entityType: 'reservation',
      dateFrom: new Date('2026-09-01T00:00:00Z'),
      dateTo: new Date('2026-09-30T23:59:59Z'),
    });
  });

  it('permite el rol Auditoria ademas de Administracion (VIEW_AUDIT)', async () => {
    const authorization = buildAuthorization('AUDITORIA');
    const handler = new ListAuditEventsHandler(authorization, buildAuditEvents([]), buildIdentity());

    await expect(
      handler.execute(new ListAuditEventsQuery('uid-1', 'company-1', 'branch-1')),
    ).resolves.toEqual([]);
  });

  it('rechaza cuando el rol autorizado no es Administracion ni Auditoria', async () => {
    const authorization = buildAuthorization('FRONT_OFFICE');
    const handler = new ListAuditEventsHandler(authorization, buildAuditEvents([]), buildIdentity());

    await expect(
      handler.execute(new ListAuditEventsQuery('uid-1', 'company-1', 'branch-1')),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('no llama a la identidad cuando no hay eventos', async () => {
    const authorization = buildAuthorization();
    const auditEvents = buildAuditEvents([]);
    const identity = buildIdentity();
    const handler = new ListAuditEventsHandler(authorization, auditEvents, identity);

    const result = await handler.execute(new ListAuditEventsQuery('uid-admin', 'company-1', 'branch-1'));

    expect(identity.findEmailsByUids).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('no llama a la identidad para eventos sin actor (ej. eventos de Consulta)', async () => {
    const authorization = buildAuthorization();
    const record: AuditEventRecord = {
      id: 'event-2',
      organizationId: 'org-1',
      actorUserId: null,
      entityType: 'inquiry',
      entityId: 'inq-1',
      action: 'INQUIRY_CLOSED',
      changes: null,
      createdAt: new Date('2026-09-23T12:00:00Z'),
    };
    const auditEvents = buildAuditEvents([record]);
    const identity = buildIdentity();
    const handler = new ListAuditEventsHandler(authorization, auditEvents, identity);

    const result = await handler.execute(new ListAuditEventsQuery('uid-admin', 'company-1', 'branch-1'));

    expect(identity.findEmailsByUids).not.toHaveBeenCalled();
    expect(result[0].actorEmail).toBeNull();
  });
});
