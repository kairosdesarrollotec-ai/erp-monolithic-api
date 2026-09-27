import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { GetReservationHandler } from './get-reservation.handler';
import { GetReservationQuery } from './get-reservation.query';
import { ReservationRepositoryPort, ReservationRecord, ReservationScope } from '../ports/reservation-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';

function buildRecord(): ReservationRecord {
  return {
    id: 'res-1', organizationId: 'org-1', operatingCompanyId: 'company-1', branchId: 'branch-1',
    inquiryId: 'inq-1', customerId: 'cust-1', customerName: 'Maria Quispe', vehicleId: 'veh-1',
    vehiclePlate: 'D0Y-704', vehicleLabel: 'Toyota Hilux - D0Y-704', status: 'DRAFT',
    channelMode: 'PRESENCIAL', startAt: new Date(), endAt: new Date(), requiredPaymentAmount: '300.00',
    currency: 'PEN', paymentPolicyVersion: 1, paymentValidatedAt: null, documentsCompletedAt: null,
    confirmedAt: null, createdAt: new Date(), createdBy: 'uid-1', version: 1,
  };
}

const SCOPE: ReservationScope = { organizationId: 'org-1', operatingCompanyId: 'company-1', branchId: 'branch-1' };

function buildDeps(record: ReservationRecord | null, forbidden = false) {
  const reservations: jest.Mocked<ReservationRepositoryPort> = {
    findCustomerById: jest.fn(), findVehicleById: jest.fn(), isVehicleAvailable: jest.fn(),
    create: jest.fn(), findById: jest.fn().mockResolvedValue(record), list: jest.fn(),
    registerPayment: jest.fn(), registerDocuments: jest.fn(), confirm: jest.fn(), cancel: jest.fn(),
  };
  const workContext = {
    authorize: forbidden
      ? jest.fn().mockRejectedValue(new ForbiddenException())
      : jest.fn().mockResolvedValue({ organizationId: 'org-1', companyId: 'company-1', branchId: 'branch-1', role: 'FRONT_OFFICE' }),
  } as unknown as jest.Mocked<WorkContextAuthorizationService>;
  return { reservations, workContext };
}

describe('GetReservationHandler', () => {
  it('devuelve la reserva cuando la asignacion es valida', async () => {
    const { reservations, workContext } = buildDeps(buildRecord());
    const handler = new GetReservationHandler(reservations, workContext);
    const result = await handler.execute(new GetReservationQuery('res-1', 'uid-1', 'company-1', 'branch-1'));
    expect(result.id).toBe('res-1');
  });

  /**
   * Hallazgo critico de revision PR#6 ("IDOR entre sedes/empresas"): una
   * reserva de OTRA sede de la misma organizacion, con una asignacion
   * vigente distinta, debe tratarse como inexistente (404) - nunca como
   * accesible solo por compartir organizationId.
   */
  it('busca la reserva por el scope completo (organizationId + operatingCompanyId + branchId), no solo por organizationId', async () => {
    const { reservations, workContext } = buildDeps(buildRecord());
    const handler = new GetReservationHandler(reservations, workContext);
    await handler.execute(new GetReservationQuery('res-1', 'uid-1', 'company-1', 'branch-1'));
    expect(reservations.findById).toHaveBeenCalledWith('res-1', SCOPE);
  });

  it('rechaza si la reserva no existe en el scope del usuario', async () => {
    const { reservations, workContext } = buildDeps(null);
    const handler = new GetReservationHandler(reservations, workContext);
    await expect(
      handler.execute(new GetReservationQuery('res-x', 'uid-1', 'company-1', 'branch-1')),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rechaza si la asignacion no es vigente', async () => {
    const { reservations, workContext } = buildDeps(null, true);
    const handler = new GetReservationHandler(reservations, workContext);
    await expect(
      handler.execute(new GetReservationQuery('res-1', 'uid-1', 'company-ajena', 'branch-ajena')),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
