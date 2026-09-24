import { ForbiddenException } from '@nestjs/common';
import { ListReservationsHandler } from './list-reservations.handler';
import { ListReservationsQuery } from './list-reservations.query';
import { ReservationRepositoryPort } from '../ports/reservation-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';

function buildDeps(forbidden = false) {
  const reservations: jest.Mocked<ReservationRepositoryPort> = {
    create: jest.fn(), findById: jest.fn(), list: jest.fn().mockResolvedValue([]),
    registerPayment: jest.fn(), registerDocuments: jest.fn(), confirm: jest.fn(), cancel: jest.fn(),
  };
  const workContext = {
    authorize: forbidden
      ? jest.fn().mockRejectedValue(new ForbiddenException())
      : jest.fn().mockResolvedValue({ organizationId: 'org-1', companyId: 'company-1', branchId: 'branch-1', role: 'FRONT_OFFICE' }),
  } as unknown as jest.Mocked<WorkContextAuthorizationService>;
  return { reservations, workContext };
}

describe('ListReservationsHandler', () => {
  it('lista las reservas de la sede en el scope validado', async () => {
    const { reservations, workContext } = buildDeps();
    const handler = new ListReservationsHandler(reservations, workContext);
    await handler.execute(new ListReservationsQuery('uid-1', 'company-1', 'branch-1', 'CONFIRMED'));
    expect(reservations.list).toHaveBeenCalledWith({
      organizationId: 'org-1', operatingCompanyId: 'company-1', branchId: 'branch-1',
      status: 'CONFIRMED', limit: 20, cursor: undefined,
    });
  });

  /**
   * Hallazgo critico de revision PR#6 ("bug de bandeja: companyId
   * enviado como branchId"): antes el controller pasaba companyId dos
   * veces al construir esta query, asi que el filtro real de sede que
   * llegaba al repositorio era `branchId: companyId` - nunca coincidia
   * con una sede real y la bandeja quedaba siempre vacia. Este test fija
   * en el handler que branchId de la query (no companyId) es el que se
   * reenvia al repositorio.
   */
  it('usa el branchId de la query, no el companyId, al filtrar', async () => {
    const { reservations, workContext } = buildDeps();
    const handler = new ListReservationsHandler(reservations, workContext);
    await handler.execute(new ListReservationsQuery('uid-1', 'company-1', 'branch-distinto-de-company-1'));
    expect(reservations.list).toHaveBeenCalledWith(
      expect.objectContaining({ branchId: 'branch-distinto-de-company-1' }),
    );
  });

  it('rechaza si la asignacion no es vigente', async () => {
    const { reservations, workContext } = buildDeps(true);
    const handler = new ListReservationsHandler(reservations, workContext);
    await expect(
      handler.execute(new ListReservationsQuery('uid-1', 'company-ajena', 'branch-ajena')),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
