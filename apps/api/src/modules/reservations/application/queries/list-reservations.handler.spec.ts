import { ForbiddenException } from '@nestjs/common';
import { ListReservationsHandler } from './list-reservations.handler';
import { ListReservationsQuery } from './list-reservations.query';
import { ReservationRepositoryPort } from '../ports/reservation-repository.port';
import { WorkContextRepositoryPort } from '../../../users/application/ports/work-context-repository.port';

describe('ListReservationsHandler', () => {
  it('lista las reservas de la empresa en el scope validado', async () => {
    const reservations: jest.Mocked<ReservationRepositoryPort> = {
      create: jest.fn(), findById: jest.fn(), list: jest.fn().mockResolvedValue([]),
      registerPayment: jest.fn(), registerDocuments: jest.fn(), confirm: jest.fn(), cancel: jest.fn(),
    };
    const workContext: jest.Mocked<WorkContextRepositoryPort> = {
      findAssignmentsByFirebaseUid: jest.fn(),
      findValidAssignment: jest.fn().mockResolvedValue({ organizationId: 'org-1', role: 'FRONT_OFFICE' }),
    };
    const handler = new ListReservationsHandler(reservations, workContext);
    await handler.execute(new ListReservationsQuery('uid-1', 'company-1', 'branch-1', 'CONFIRMED'));
    expect(reservations.list).toHaveBeenCalledWith({
      organizationId: 'org-1', operatingCompanyId: 'company-1', status: 'CONFIRMED',
    });
  });

  it('rechaza si la asignacion no es vigente', async () => {
    const reservations: jest.Mocked<ReservationRepositoryPort> = {
      create: jest.fn(), findById: jest.fn(), list: jest.fn(),
      registerPayment: jest.fn(), registerDocuments: jest.fn(), confirm: jest.fn(), cancel: jest.fn(),
    };
    const workContext: jest.Mocked<WorkContextRepositoryPort> = {
      findAssignmentsByFirebaseUid: jest.fn(), findValidAssignment: jest.fn().mockResolvedValue(null),
    };
    const handler = new ListReservationsHandler(reservations, workContext);
    await expect(
      handler.execute(new ListReservationsQuery('uid-1', 'company-ajena', 'branch-ajena')),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
