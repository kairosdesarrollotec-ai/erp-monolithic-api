import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { RegisterDocumentsHandler } from './register-documents.handler';
import { RegisterDocumentsCommand } from './register-documents.command';
import { ReservationRepositoryPort, ReservationRecord, ReservationScope } from '../ports/reservation-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { assertReservationRoleAllowed } from '../policies/reservation-role-policy';
import { ReservationStateConflictError } from '../../domain/reservation-errors';

function buildRecord(overrides: Partial<ReservationRecord> = {}): ReservationRecord {
  return {
    id: 'res-1', organizationId: 'org-1', operatingCompanyId: 'company-1', branchId: 'branch-1',
    inquiryId: 'inq-1', customerId: 'cust-1', customerName: 'Maria Quispe', vehicleId: 'veh-1',
    vehiclePlate: 'D0Y-704', vehicleLabel: 'Toyota Hilux - D0Y-704', status: 'DRAFT',
    channelMode: 'PRESENCIAL', startAt: new Date(), endAt: new Date(), requiredPaymentAmount: '300.00',
    currency: 'PEN', paymentPolicyVersion: 1, paymentValidatedAt: null, documentsCompletedAt: null,
    confirmedAt: null, createdAt: new Date(), createdBy: 'uid-1', version: 1,
    ...overrides,
  };
}

const SCOPE: ReservationScope = { organizationId: 'org-1', operatingCompanyId: 'company-1', branchId: 'branch-1' };

function buildDeps(existing: ReservationRecord | null, forbidden = false, role = 'FRONT_OFFICE') {
  const reservations: jest.Mocked<ReservationRepositoryPort> = {
    create: jest.fn(), findById: jest.fn().mockResolvedValue(existing), list: jest.fn(),
    registerPayment: jest.fn(),
    registerDocuments: jest.fn().mockResolvedValue(existing ? { ...existing, documentsCompletedAt: new Date(), version: 2 } : undefined),
    confirm: jest.fn(), cancel: jest.fn(),
  };
  const workContext = {
    authorize: forbidden
      ? jest.fn().mockRejectedValue(new ForbiddenException())
      : jest.fn().mockResolvedValue({ organizationId: 'org-1', companyId: 'company-1', branchId: 'branch-1', role }),
  } as unknown as jest.Mocked<WorkContextAuthorizationService>;
  const matrixAuth = {
    assertAllowed: jest.fn().mockImplementation(async (_orgId, r, _mod, action) => {
      assertReservationRoleAllowed(r, action);
    }),
    isAllowed: jest.fn().mockResolvedValue(true),
  } as unknown as MatrixAuthorizationService;
  return { reservations, workContext, matrixAuth };
}

describe('RegisterDocumentsHandler', () => {
  it('marca documents_completed_at sin tocar disponibilidad', async () => {
    const { reservations, workContext, matrixAuth } = buildDeps(buildRecord());
    const handler = new RegisterDocumentsHandler(reservations, workContext, matrixAuth);
    const result = await handler.execute(new RegisterDocumentsCommand('res-1', 'uid-1', 'company-1', 'branch-1', 1));
    expect(reservations.registerDocuments).toHaveBeenCalledWith('res-1', SCOPE, 1);
    expect(result.documentsCompletedAt).not.toBeNull();
  });

  it('rechaza si la reserva no existe', async () => {
    const { reservations, workContext, matrixAuth } = buildDeps(null);
    const handler = new RegisterDocumentsHandler(reservations, workContext, matrixAuth);
    await expect(
      handler.execute(new RegisterDocumentsCommand('res-x', 'uid-1', 'company-1', 'branch-1', 1)),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rechaza si la reserva ya no esta en DRAFT (maquina de estados)', async () => {
    const { reservations, workContext, matrixAuth } = buildDeps(buildRecord({ status: 'CANCELLED' }));
    const handler = new RegisterDocumentsHandler(reservations, workContext, matrixAuth);
    await expect(
      handler.execute(new RegisterDocumentsCommand('res-1', 'uid-1', 'company-1', 'branch-1', 1)),
    ).rejects.toBeInstanceOf(ReservationStateConflictError);
  });

  // Hallazgo ALTO PR#6 ("falta autorizacion granular por rol/accion").
  it('rechaza registrar documentos si el rol autorizado no esta en la matriz de Reserva', async () => {
    const { reservations, workContext, matrixAuth } = buildDeps(buildRecord(), false, 'CAMPO');
    const handler = new RegisterDocumentsHandler(reservations, workContext, matrixAuth);
    await expect(
      handler.execute(new RegisterDocumentsCommand('res-1', 'uid-1', 'company-1', 'branch-1', 1)),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(reservations.registerDocuments).not.toHaveBeenCalled();
  });

  it('rechaza registrar documentos si la matriz personalizada versionada revoca REGISTER_DOCUMENTS', async () => {
    const { reservations, workContext } = buildDeps(buildRecord(), false, 'FRONT_OFFICE');
    const matrixAuth = {
      assertAllowed: jest.fn().mockRejectedValue(
        new ForbiddenException({
          code: 'ROLE_NOT_ALLOWED',
          detail: 'El rol FRONT_OFFICE no tiene permiso para realizar la accion REGISTER_DOCUMENTS sobre una Reserva segun la matriz vigente (version 2).',
        }),
      ),
      isAllowed: jest.fn().mockResolvedValue(false),
    } as unknown as MatrixAuthorizationService;

    const handler = new RegisterDocumentsHandler(reservations, workContext, matrixAuth);
    await expect(
      handler.execute(new RegisterDocumentsCommand('res-1', 'uid-1', 'company-1', 'branch-1', 1)),
    ).rejects.toMatchObject({
      response: {
        code: 'ROLE_NOT_ALLOWED',
      },
    });
    expect(reservations.registerDocuments).not.toHaveBeenCalled();
  });
});
