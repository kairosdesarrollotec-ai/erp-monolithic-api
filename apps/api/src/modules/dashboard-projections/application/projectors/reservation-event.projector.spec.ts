import { projectReservationEvent } from './reservation-event.projector';

describe('projectReservationEvent', () => {
  it('ReservationCreated genera una tarea para Front-office con deepLink a la ruta real del frontend', () => {
    const result = projectReservationEvent({
      id: 'evt-1',
      aggregateId: 'res-1',
      eventType: 'ReservationCreated',
      payload: {
        organizationId: 'org-1',
        operatingCompanyId: 'company-1',
        branchId: 'branch-1',
        vehicleId: 'veh-1',
        startAt: '2026-09-25T10:00:00Z',
        endAt: '2026-09-28T10:00:00Z',
      },
    });

    expect(result).toEqual({
      action: 'UPSERT',
      item: expect.objectContaining({
        role: 'FRONT_OFFICE',
        itemType: 'TASK',
        sourceType: 'RESERVATION',
        sourceId: 'res-1',
        deepLink: '/reservas/res-1',
      }),
    });
  });

  it('ReservationConfirmed descarta la tarea pendiente (ya no requiere atencion)', () => {
    const result = projectReservationEvent({ id: 'evt-2', aggregateId: 'res-1', eventType: 'ReservationConfirmed', payload: {} });
    expect(result).toEqual({ action: 'DISMISS', sourceType: 'RESERVATION', sourceId: 'res-1' });
  });

  it('ReservationCancelled descarta la tarea pendiente', () => {
    const result = projectReservationEvent({ id: 'evt-3', aggregateId: 'res-1', eventType: 'ReservationCancelled', payload: {} });
    expect(result).toEqual({ action: 'DISMISS', sourceType: 'RESERVATION', sourceId: 'res-1' });
  });

  it('ignora eventos que no le corresponden', () => {
    const result = projectReservationEvent({ id: 'evt-4', aggregateId: 'res-1', eventType: 'InquiryCreated', payload: {} });
    expect(result).toEqual({ action: 'IGNORE' });
  });
});
