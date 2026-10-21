import { NotFoundException, PayloadTooLargeException } from '@nestjs/common';
import {
  RequestEvidenceUploadSessionHandler,
  MAX_EVIDENCE_PHOTO_BYTES,
  MAX_EVIDENCE_VIDEO_BYTES,
} from './request-evidence-upload-session.handler';
import { RequestEvidenceUploadSessionCommand } from './request-evidence-upload-session.command';
import { RentalStateConflictError } from '../../domain/rental-errors';
import { testRole } from '../../../users/testing/role-fixtures';

function buildStoragePort() {
  return {
    generateSignedUploadUrl: jest.fn().mockResolvedValue({
      uploadUrl: 'https://storage.googleapis.com/bucket/upload-signed-url',
      objectUrl: 'https://storage.googleapis.com/bucket/rental-evidence/.../uuid.jpg',
    }),
  };
}

function buildRentalsPort(status = 'PENDING_DELIVERY') {
  return {
    findById: jest.fn().mockResolvedValue({ id: 'rent-1', status, vehicleId: 'veh-1' }),
  };
}

function buildWorkContext() {
  return {
    authorize: jest.fn().mockResolvedValue({
      organizationId: 'org-1',
      companyId: 'comp-1',
      branchId: 'branch-1',
      ...testRole('FRONT_OFFICE'),
    }),
  };
}

function buildMatrixAuth() {
  return { assertAllowed: jest.fn().mockResolvedValue(undefined) };
}

describe('RequestEvidenceUploadSessionHandler', () => {
  it('genera una sesión de carga y retorna uploadUrl y objectUrl', async () => {
    const storage = buildStoragePort();
    const rentals = buildRentalsPort();
    const workContext = buildWorkContext();
    const matrixAuth = buildMatrixAuth();
    const handler = new RequestEvidenceUploadSessionHandler(storage as any, rentals as any, workContext as any, matrixAuth as any);

    const result = await handler.execute(
      new RequestEvidenceUploadSessionCommand('rent-1', 'uid-1', 'comp-1', 'branch-1', 'PHOTO', 'FRONTAL', 'image/jpeg', 500_000),
    );

    expect(matrixAuth.assertAllowed).toHaveBeenCalledWith('org-1', 'role-FRONT_OFFICE', 'RENTAL', 'UPLOAD_EVIDENCE', expect.anything());
    expect(storage.generateSignedUploadUrl).toHaveBeenCalledWith({
      companyId: 'comp-1',
      rentalId: 'rent-1',
      type: 'PHOTO',
      zone: 'FRONTAL',
      contentType: 'image/jpeg',
    });
    expect(result.objectUrl).toContain('storage.googleapis.com');
  });

  it('lanza PayloadTooLargeException si la foto supera 12 MB', async () => {
    const storage = buildStoragePort();
    const rentals = buildRentalsPort();
    const handler = new RequestEvidenceUploadSessionHandler(storage as any, rentals as any, buildWorkContext() as any, buildMatrixAuth() as any);

    await expect(
      handler.execute(
        new RequestEvidenceUploadSessionCommand(
          'rent-1', 'uid-1', 'comp-1', 'branch-1', 'PHOTO', 'FRONTAL', 'image/jpeg', MAX_EVIDENCE_PHOTO_BYTES + 1,
        ),
      ),
    ).rejects.toThrow(PayloadTooLargeException);
    expect(storage.generateSignedUploadUrl).not.toHaveBeenCalled();
  });

  it('lanza PayloadTooLargeException si el video supera el máximo permitido', async () => {
    const storage = buildStoragePort();
    const rentals = buildRentalsPort();
    const handler = new RequestEvidenceUploadSessionHandler(storage as any, rentals as any, buildWorkContext() as any, buildMatrixAuth() as any);

    await expect(
      handler.execute(
        new RequestEvidenceUploadSessionCommand(
          'rent-1', 'uid-1', 'comp-1', 'branch-1', 'VIDEO', 'FRONTAL', 'video/mp4', MAX_EVIDENCE_VIDEO_BYTES + 1,
        ),
      ),
    ).rejects.toThrow(PayloadTooLargeException);
  });

  it('lanza NotFoundException si el alquiler no existe', async () => {
    const storage = buildStoragePort();
    const rentals = { findById: jest.fn().mockResolvedValue(null) };
    const handler = new RequestEvidenceUploadSessionHandler(storage as any, rentals as any, buildWorkContext() as any, buildMatrixAuth() as any);

    await expect(
      handler.execute(
        new RequestEvidenceUploadSessionCommand('rent-1', 'uid-1', 'comp-1', 'branch-1', 'PHOTO', 'FRONTAL', 'image/jpeg', 1000),
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('lanza RentalStateConflictError si el alquiler no esta en PENDING_DELIVERY', async () => {
    const storage = buildStoragePort();
    const rentals = buildRentalsPort('ACTIVE');
    const handler = new RequestEvidenceUploadSessionHandler(storage as any, rentals as any, buildWorkContext() as any, buildMatrixAuth() as any);

    await expect(
      handler.execute(
        new RequestEvidenceUploadSessionCommand('rent-1', 'uid-1', 'comp-1', 'branch-1', 'PHOTO', 'FRONTAL', 'image/jpeg', 1000),
      ),
    ).rejects.toThrow(RentalStateConflictError);
  });

  describe('ENTREGA-02: zona ALCOHOL_TEST (Respuestas 2026-10-20 #10)', () => {
    const photoCmd = (zone: string) =>
      new RequestEvidenceUploadSessionCommand('rent-1', 'uid-1', 'comp-1', 'branch-1', 'PHOTO', zone as any, 'image/jpeg', 1000);

    it('la foto del alcolimetro se sube en VALIDATION', async () => {
      const storage = buildStoragePort();
      const handler = new RequestEvidenceUploadSessionHandler(storage as any, buildRentalsPort('VALIDATION') as any, buildWorkContext() as any, buildMatrixAuth() as any);
      await expect(handler.execute(photoCmd('ALCOHOL_TEST'))).resolves.toBeDefined();
      expect(storage.generateSignedUploadUrl).toHaveBeenCalledWith(expect.objectContaining({ zone: 'ALCOHOL_TEST' }));
    });

    it('la foto del alcolimetro no se sube en PENDING_DELIVERY y una zona normal no se sube en VALIDATION', async () => {
      const h1 = new RequestEvidenceUploadSessionHandler(buildStoragePort() as any, buildRentalsPort('PENDING_DELIVERY') as any, buildWorkContext() as any, buildMatrixAuth() as any);
      await expect(h1.execute(photoCmd('ALCOHOL_TEST'))).rejects.toThrow(RentalStateConflictError);
      const h2 = new RequestEvidenceUploadSessionHandler(buildStoragePort() as any, buildRentalsPort('VALIDATION') as any, buildWorkContext() as any, buildMatrixAuth() as any);
      await expect(h2.execute(photoCmd('FRONTAL'))).rejects.toThrow(RentalStateConflictError);
    });
  });
});
