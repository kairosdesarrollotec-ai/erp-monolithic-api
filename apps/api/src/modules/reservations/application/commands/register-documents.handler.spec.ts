import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { RegisterDocumentsHandler } from './register-documents.handler';
import { RegisterDocumentsCommand } from './register-documents.command';
import { ReservationRepositoryPort, ReservationRecord, ReservationScope } from '../ports/reservation-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { assertReservationRoleAllowed } from '../policies/reservation-role-policy';
import { DocumentsNotUploadedError, ReservationStateConflictError } from '../../domain/reservation-errors';
import { ReservationDocumentRepositoryPort } from '../ports/reservation-document-repository.port';
import { roleKeyOfTestRoleId, testRole } from '../../../users/testing/role-fixtures';

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

function buildDeps(existing: ReservationRecord | null, forbidden = false, role = 'FRONT_OFFICE', uploadedDocuments = 1) {
  const reservations: jest.Mocked<ReservationRepositoryPort> = {
    findCustomerById: jest.fn(), findVehicleById: jest.fn(), isVehicleAvailable: jest.fn(),
    create: jest.fn(), findById: jest.fn().mockResolvedValue(existing), list: jest.fn(),
    registerPayment: jest.fn(),
    registerDocuments: jest.fn().mockResolvedValue(existing ? { ...existing, documentsCompletedAt: new Date(), version: 2 } : undefined),
    confirm: jest.fn(), cancel: jest.fn(),
  };
  const workContext = {
    authorize: forbidden
      ? jest.fn().mockRejectedValue(new ForbiddenException())
      : jest.fn().mockResolvedValue({ organizationId: 'org-1', companyId: 'company-1', branchId: 'branch-1', ...testRole(role) }),
  } as unknown as jest.Mocked<WorkContextAuthorizationService>;
  const matrixAuth = {
    assertAllowed: jest.fn().mockImplementation(async (_orgId, r, _mod, action) => {
      assertReservationRoleAllowed(roleKeyOfTestRoleId(r), action);
    }),
    isAllowed: jest.fn().mockResolvedValue(true),
  } as unknown as MatrixAuthorizationService;
  const documents = {
    record: jest.fn(), list: jest.fn(), findById: jest.fn(),
    countCustomerDocuments: jest.fn().mockResolvedValue(uploadedDocuments),
  } as unknown as jest.Mocked<ReservationDocumentRepositoryPort>;
  return { reservations, documents, workContext, matrixAuth };
}

describe('RegisterDocumentsHandler', () => {
  it('marca documents_completed_at sin tocar disponibilidad', async () => {
    const { reservations, documents, workContext, matrixAuth } = buildDeps(buildRecord());
    const handler = new RegisterDocumentsHandler(reservations, documents, workContext, matrixAuth);
    const result = await handler.execute(new RegisterDocumentsCommand('res-1', 'uid-1', 'company-1', 'branch-1', 1));
    expect(reservations.registerDocuments).toHaveBeenCalledWith('res-1', SCOPE, 1);
    expect(result.documentsCompletedAt).not.toBeNull();
  });

  it('PEND-12: sin documentos del cliente subidos -> 422 DOCUMENTS_NOT_UPLOADED y NO marca documents_completed_at', async () => {
    const { reservations, documents, workContext, matrixAuth } = buildDeps(buildRecord(), false, 'FRONT_OFFICE', 0);
    const handler = new RegisterDocumentsHandler(reservations, documents, workContext, matrixAuth);

    await expect(
      handler.execute(new RegisterDocumentsCommand('res-1', 'uid-1', 'company-1', 'branch-1', 1)),
    ).rejects.toBeInstanceOf(DocumentsNotUploadedError);
    expect(documents.countCustomerDocuments).toHaveBeenCalledWith('res-1');
    expect(reservations.registerDocuments).not.toHaveBeenCalled();
  });

  it('rechaza si la reserva no existe', async () => {
    const { reservations, documents, workContext, matrixAuth } = buildDeps(null);
    const handler = new RegisterDocumentsHandler(reservations, documents, workContext, matrixAuth);
    await expect(
      handler.execute(new RegisterDocumentsCommand('res-x', 'uid-1', 'company-1', 'branch-1', 1)),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rechaza si la reserva ya no esta en DRAFT (maquina de estados)', async () => {
    const { reservations, documents, workContext, matrixAuth } = buildDeps(buildRecord({ status: 'CANCELLED' }));
    const handler = new RegisterDocumentsHandler(reservations, documents, workContext, matrixAuth);
    await expect(
      handler.execute(new RegisterDocumentsCommand('res-1', 'uid-1', 'company-1', 'branch-1', 1)),
    ).rejects.toBeInstanceOf(ReservationStateConflictError);
  });

  // Hallazgo ALTO PR#6 ("falta autorizacion granular por rol/accion").
  it('rechaza registrar documentos si el rol autorizado no esta en la matriz de Reserva', async () => {
    const { reservations, documents, workContext, matrixAuth } = buildDeps(buildRecord(), false, 'CAMPO');
    const handler = new RegisterDocumentsHandler(reservations, documents, workContext, matrixAuth);
    await expect(
      handler.execute(new RegisterDocumentsCommand('res-1', 'uid-1', 'company-1', 'branch-1', 1)),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(reservations.registerDocuments).not.toHaveBeenCalled();
  });

  it('rechaza registrar documentos si la matriz personalizada versionada revoca REGISTER_DOCUMENTS', async () => {
    const { reservations, documents, workContext } = buildDeps(buildRecord(), false, 'FRONT_OFFICE');
    const matrixAuth = {
      assertAllowed: jest.fn().mockRejectedValue(
        new ForbiddenException({
          code: 'ROLE_NOT_ALLOWED',
          detail: 'El rol FRONT_OFFICE no tiene permiso para realizar la accion REGISTER_DOCUMENTS sobre una Reserva segun la matriz vigente (version 2).',
        }),
      ),
      isAllowed: jest.fn().mockResolvedValue(false),
    } as unknown as MatrixAuthorizationService;

    const handler = new RegisterDocumentsHandler(reservations, documents, workContext, matrixAuth);
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
