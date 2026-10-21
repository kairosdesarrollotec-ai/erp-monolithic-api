import { ForbiddenException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { CreateReservationHandler } from './create-reservation.handler';
import { CreateReservationCommand } from './create-reservation.command';
import { ReservationRepositoryPort } from '../ports/reservation-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { assertReservationRoleAllowed } from '../policies/reservation-role-policy';
import { roleKeyOfTestRoleId, testRole } from '../../../users/testing/role-fixtures';

/**
 * CONFLICT-CON-001 (resuelto): `POST /reservations` crea reservas directamente.
 * La via desde una Consulta sigue siendo convert-to-reservation.
 */
describe('CreateReservationHandler', () => {
  const ORG = 'org-1';
  const COMPANY = 'company-1';
  const BRANCH = 'branch-1';

  function buildCommand(overrides: { customerId?: string; vehicleId?: string; inquiryId?: string } = {}) {
    return new CreateReservationCommand(
      'uid-1',
      COMPANY,
      BRANCH,
      overrides.customerId ?? 'cust-1',
      overrides.vehicleId ?? 'veh-1',
      'PRESENCIAL',
      new Date('2026-10-20T14:00:00Z'),
      new Date('2026-10-22T14:00:00Z'),
      '300.00',
      'PEN',
      1,
      overrides.inquiryId,
    );
  }

  function buildRepository(): jest.Mocked<ReservationRepositoryPort> {
    const record = {
      id: 'res-1',
      organizationId: ORG,
      operatingCompanyId: COMPANY,
      branchId: BRANCH,
      inquiryId: null,
      customerId: 'cust-1',
      customerName: 'Ana Prospecto',
      vehicleId: 'veh-1',
      vehiclePlate: 'ABC-123',
      vehicleLabel: 'Toyota Hilux - ABC-123',
      status: 'DRAFT' as const,
      channelMode: 'PRESENCIAL' as const,
      startAt: new Date('2026-10-20T14:00:00Z'),
      endAt: new Date('2026-10-22T14:00:00Z'),
      requiredPaymentAmount: '300.00',
      currency: 'PEN',
      paymentPolicyVersion: 1,
      paymentValidatedAt: null,
      documentsCompletedAt: null,
      confirmedAt: null,
      createdAt: new Date(),
      createdBy: 'uid-1',
      version: 1,
    };
    return {
      findCustomerById: jest.fn().mockResolvedValue({ id: 'cust-1', organizationId: ORG, operatingCompanyId: COMPANY }),
      findVehicleById: jest.fn().mockResolvedValue({ id: 'veh-1', operatingCompanyId: COMPANY }),
      isVehicleAvailable: jest.fn().mockResolvedValue(true),
      create: jest.fn().mockResolvedValue(record),
      findById: jest.fn().mockResolvedValue(record),
      list: jest.fn().mockResolvedValue([]),
      registerPayment: jest.fn(),
      registerDocuments: jest.fn(),
      confirm: jest.fn(),
      cancel: jest.fn(),
    } as unknown as jest.Mocked<ReservationRepositoryPort>;
  }

  function buildWorkContext(result: { role: string } | 'forbidden') {
    return {
      authorize:
        result === 'forbidden'
          ? jest.fn().mockRejectedValue(new ForbiddenException())
          : jest.fn().mockResolvedValue({
              organizationId: ORG,
              companyId: COMPANY,
              branchId: BRANCH,
              ...testRole(result.role),
            }),
    } as unknown as jest.Mocked<WorkContextAuthorizationService>;
  }

  function buildMatrixAuth(): MatrixAuthorizationService {
    return {
      assertAllowed: jest.fn().mockImplementation(async (_orgId, role, _module, action) => {
        assertReservationRoleAllowed(roleKeyOfTestRoleId(role), action);
      }),
      isAllowed: jest.fn().mockResolvedValue(true),
    } as unknown as MatrixAuthorizationService;
  }

  it('rechaza con RESERVATION_EXCEEDS_GUARANTEE 422 si el monto supera la garantía del vehículo', async () => {
    const repo = buildRepository();
    repo.findVehicleById.mockResolvedValue({ id: 'veh-1', operatingCompanyId: COMPANY, depositMinimum: 250 });
    const handler = new CreateReservationHandler(
      repo,
      buildWorkContext({ role: 'FRONT_OFFICE' }) as unknown as WorkContextAuthorizationService,
      buildMatrixAuth() as unknown as MatrixAuthorizationService,
    );
    await expect(handler.execute(buildCommand())).rejects.toMatchObject({
      code: 'RESERVATION_EXCEEDS_GUARANTEE',
      httpStatus: 422,
    });
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('acepta una reserva igual a la garantía del vehículo', async () => {
    const repo = buildRepository();
    repo.findVehicleById.mockResolvedValue({ id: 'veh-1', operatingCompanyId: COMPANY, depositMinimum: 300 });
    const handler = new CreateReservationHandler(
      repo,
      buildWorkContext({ role: 'FRONT_OFFICE' }) as unknown as WorkContextAuthorizationService,
      buildMatrixAuth() as unknown as MatrixAuthorizationService,
    );
    await expect(handler.execute(buildCommand())).resolves.toBeDefined();
    expect(repo.create).toHaveBeenCalled();
  });

  it('crea la reserva cuando el cliente y vehiculo son validos (caso directo sin consulta)', async () => {
    const repo = buildRepository();
    const handler = new CreateReservationHandler(repo, buildWorkContext({ role: 'FRONT_OFFICE' }), buildMatrixAuth());

    const result = await handler.execute(buildCommand());

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ customerId: 'cust-1', vehicleId: 'veh-1', requiredPaymentAmount: '300.00' }),
    );
    expect(result.id).toBe('res-1');
  });

  it('responde 404 si el cliente no existe en la empresa', async () => {
    const repo = buildRepository();
    repo.findCustomerById.mockResolvedValue(null);
    const handler = new CreateReservationHandler(repo, buildWorkContext({ role: 'FRONT_OFFICE' }), buildMatrixAuth());

    await expect(handler.execute(buildCommand())).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('responde 404 si el vehiculo no existe en la empresa', async () => {
    const repo = buildRepository();
    repo.findVehicleById.mockResolvedValue(null);
    const handler = new CreateReservationHandler(repo, buildWorkContext({ role: 'FRONT_OFFICE' }), buildMatrixAuth());

    await expect(handler.execute(buildCommand())).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('responde 422 si el vehiculo no esta disponible', async () => {
    const repo = buildRepository();
    repo.isVehicleAvailable.mockResolvedValue(false);
    const handler = new CreateReservationHandler(repo, buildWorkContext({ role: 'FRONT_OFFICE' }), buildMatrixAuth());

    await expect(handler.execute(buildCommand())).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('sigue exigiendo un contexto empresa/sede vigente (403 antes de revelar nada)', async () => {
    const handler = new CreateReservationHandler(buildRepository(), buildWorkContext('forbidden'), buildMatrixAuth());

    await expect(handler.execute(buildCommand())).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('sigue aplicando la politica rol-accion CREATE (403 para un rol sin permiso)', async () => {
    const handler = new CreateReservationHandler(buildRepository(), buildWorkContext({ role: 'CAMPO' }), buildMatrixAuth());

    await expect(handler.execute(buildCommand())).rejects.toBeInstanceOf(ForbiddenException);
  });
});
