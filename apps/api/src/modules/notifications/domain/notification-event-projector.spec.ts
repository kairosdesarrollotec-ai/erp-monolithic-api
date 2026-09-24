import { projectNotificationEvent } from './notification-event-projector';

describe('projectNotificationEvent', () => {
  it('ReservationCreated: usa la plantilla guardada cuando existe, sustituyendo variables reales', () => {
    const result = projectNotificationEvent(
      {
        id: 'evt-1',
        aggregateId: 'res-1',
        eventType: 'ReservationCreated',
        payload: {
          organizationId: 'org-1',
          operatingCompanyId: 'company-1',
          branchId: 'branch-1',
          vehicleId: 'veh-1',
          startAt: '2026-09-25T00:00:00Z',
          createdBy: 'uid-agente',
        },
      },
      'Nueva reserva para {vehiculo} el {fecha}',
    );

    expect(result).toEqual({
      action: 'CREATE',
      item: expect.objectContaining({
        organizationId: 'org-1',
        companyId: 'company-1',
        branchId: 'branch-1',
        recipientFirebaseUid: 'uid-agente',
        notificationType: 'ReservationCreated',
        deepLink: '/reservas/res-1',
        sourceEventId: 'evt-1',
        title: expect.stringContaining('veh-1'),
      }),
    });
  });

  it('ReservationCreated: sin plantilla guardada, usa el texto generico de respaldo', () => {
    const result = projectNotificationEvent(
      {
        id: 'evt-2',
        aggregateId: 'res-2',
        eventType: 'ReservationCreated',
        payload: {
          organizationId: 'org-1',
          operatingCompanyId: 'company-1',
          branchId: 'branch-1',
          vehicleId: 'veh-2',
          startAt: '2026-09-25T00:00:00Z',
          createdBy: 'uid-agente',
        },
      },
      null,
    );

    expect(result.action).toBe('CREATE');
    if (result.action === 'CREATE') {
      expect(result.item.title).toContain('veh-2');
    }
  });

  it('ReservationConfirmed: el destinatario es quien confirmo', () => {
    const result = projectNotificationEvent(
      {
        id: 'evt-3',
        aggregateId: 'res-1',
        eventType: 'ReservationConfirmed',
        payload: { organizationId: 'org-1', operatingCompanyId: 'company-1', branchId: 'branch-1', confirmedBy: 'uid-confirmador' },
      },
      null,
    );

    expect(result).toEqual({
      action: 'CREATE',
      item: expect.objectContaining({ recipientFirebaseUid: 'uid-confirmador', notificationType: 'ReservationConfirmed' }),
    });
  });

  it('ReservationCancelled: el destinatario es quien cancelo', () => {
    const result = projectNotificationEvent(
      {
        id: 'evt-4',
        aggregateId: 'res-1',
        eventType: 'ReservationCancelled',
        payload: { organizationId: 'org-1', operatingCompanyId: 'company-1', branchId: 'branch-1', reason: 'NO_SHOW', cancelledBy: 'uid-cancelador' },
      },
      null,
    );

    expect(result).toEqual({
      action: 'CREATE',
      item: expect.objectContaining({ recipientFirebaseUid: 'uid-cancelador', notificationType: 'ReservationCancelled' }),
    });
  });

  it('ignora eventos que no le corresponden', () => {
    const result = projectNotificationEvent({ id: 'evt-5', aggregateId: 'x', eventType: 'InquiryCreated', payload: {} }, null);
    expect(result).toEqual({ action: 'IGNORE' });
  });
});
