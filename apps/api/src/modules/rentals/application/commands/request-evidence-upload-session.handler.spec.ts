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
});
