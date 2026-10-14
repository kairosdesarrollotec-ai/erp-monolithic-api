import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { GetReservationHandler } from './get-reservation.handler';
import { GetReservationQuery } from './get-reservation.query';
import { ReservationRepositoryPort, ReservationRecord, ReservationScope } from '../ports/reservation-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { ReservationSaleResolutionRepositoryPort } from '../ports/reservation-sale-resolution-repository.port';
import { testRole } from '../../../users/testing/role-fixtures';

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

function buildDeps(record: ReservationRecord | null, opts: { forbidden?: boolean; role?: string } = {}) {
  const reservations: jest.Mocked<ReservationRepositoryPort> = {
    findCustomerById: jest.fn(), findVehicleById: jest.fn(), isVehicleAvailable: jest.fn(),
    create: jest.fn(), findById: jest.fn().mockResolvedValue(record), list: jest.fn(),
    registerPayment: jest.fn(), registerDocuments: jest.fn(), confirm: jest.fn(), cancel: jest.fn(),
  };
  const workContext = {
    authorize: opts.forbidden
      ? jest.fn().mockRejectedValue(new ForbiddenException())
      : jest.fn().mockResolvedValue({ organizationId: 'org-1', companyId: 'company-1', branchId: 'branch-1', ...testRole(opts.role ?? 'FRONT_OFFICE') }),
  } as unknown as jest.Mocked<WorkContextAuthorizationService>;
  const matrixAuth = {
    assertAllowed: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<MatrixAuthorizationService>;
  const saleResolutions = {
    findLatestByReservationId: jest.fn().mockResolvedValue(null),
  } as unknown as jest.Mocked<ReservationSaleResolutionRepositoryPort>;
  return { reservations, workContext, matrixAuth, saleResolutions };
}

describe('GetReservationHandler', () => {
  it('devuelve la reserva cuando la asignacion es valida', async () => {
    const { reservations, workContext, matrixAuth, saleResolutions } = buildDeps(buildRecord());
    const handler = new GetReservationHandler(reservations, workContext, matrixAuth, saleResolutions);
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
    const { reservations, workContext, matrixAuth, saleResolutions } = buildDeps(buildRecord());
    const handler = new GetReservationHandler(reservations, workContext, matrixAuth, saleResolutions);
    await handler.execute(new GetReservationQuery('res-1', 'uid-1', 'company-1', 'branch-1'));
    expect(reservations.findById).toHaveBeenCalledWith('res-1', SCOPE);
  });

  it('incluye la ultima resolucion por venta del vehiculo (RES-07), o null si nunca hubo venta', async () => {
    const { reservations, workContext, matrixAuth, saleResolutions } = buildDeps(buildRecord());
    const handler = new GetReservationHandler(reservations, workContext, matrixAuth, saleResolutions);
    expect((await handler.execute(new GetReservationQuery('res-1', 'uid-1', 'company-1', 'branch-1'))).saleResolution).toBeNull();

    const resolution = { id: 'rs-1', reservationId: 'res-1', status: 'PENDING' } as any;
    saleResolutions.findLatestByReservationId.mockResolvedValueOnce(resolution);
    const result = await handler.execute(new GetReservationQuery('res-1', 'uid-1', 'company-1', 'branch-1'));
    expect(result.saleResolution).toBe(resolution);
    expect(saleResolutions.findLatestByReservationId).toHaveBeenCalledWith('res-1');
  });

  it('rechaza si la reserva no existe en el scope del usuario', async () => {
    const { reservations, workContext, matrixAuth, saleResolutions } = buildDeps(null);
    const handler = new GetReservationHandler(reservations, workContext, matrixAuth, saleResolutions);
    await expect(
      handler.execute(new GetReservationQuery('res-x', 'uid-1', 'company-1', 'branch-1')),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rechaza si la asignacion no es vigente', async () => {
    const { reservations, workContext, matrixAuth, saleResolutions } = buildDeps(null, { forbidden: true });
    const handler = new GetReservationHandler(reservations, workContext, matrixAuth, saleResolutions);
    await expect(
      handler.execute(new GetReservationQuery('res-1', 'uid-1', 'company-ajena', 'branch-ajena')),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('verifica el permiso READ_DETAIL via matrizAuth antes de consultar el repositorio', async () => {
    const { reservations, workContext, matrixAuth, saleResolutions } = buildDeps(buildRecord());
    const handler = new GetReservationHandler(reservations, workContext, matrixAuth, saleResolutions);
    await handler.execute(new GetReservationQuery('res-1', 'uid-1', 'company-1', 'branch-1'));
    expect(matrixAuth.assertAllowed).toHaveBeenCalledWith('org-1', 'role-FRONT_OFFICE', 'RESERVATION', 'READ_DETAIL', expect.anything());
  });

  it('rechaza si la matriz niega READ_DETAIL al rol del usuario', async () => {
    const { reservations, workContext, matrixAuth, saleResolutions } = buildDeps(buildRecord(), { role: 'CAMPO' });
    matrixAuth.assertAllowed = jest.fn().mockRejectedValue(new ForbiddenException({ code: 'ROLE_NOT_ALLOWED' }));
    const handler = new GetReservationHandler(reservations, workContext, matrixAuth, saleResolutions);
    await expect(
      handler.execute(new GetReservationQuery('res-1', 'uid-1', 'company-1', 'branch-1')),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(reservations.findById).not.toHaveBeenCalled();
  });

  it('AUDITORIA puede acceder al detalle de una reserva (READ_DETAIL permitido)', async () => {
    const { reservations, workContext, matrixAuth, saleResolutions } = buildDeps(buildRecord(), { role: 'AUDITORIA' });
    const handler = new GetReservationHandler(reservations, workContext, matrixAuth, saleResolutions);
    const result = await handler.execute(new GetReservationQuery('res-1', 'uid-1', 'company-1', 'branch-1'));
    expect(result.id).toBe('res-1');
    expect(matrixAuth.assertAllowed).toHaveBeenCalledWith('org-1', 'role-AUDITORIA', 'RESERVATION', 'READ_DETAIL', expect.anything());
  });
});
