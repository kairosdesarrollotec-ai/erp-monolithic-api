import { PayloadTooLargeException } from '@nestjs/common';
import { RequestPhotoUploadSessionHandler } from './request-photo-upload-session.handler';
import { BRANCH, COMPANY, buildFleetAccessService } from '../../testing/fleet-test-fixtures';

const MAX_PHOTO_BYTES = 12 * 1024 * 1024;

function buildStoragePort() {
  return {
    generateSignedUploadUrl: jest.fn().mockResolvedValue({
      uploadUrl: 'https://storage.googleapis.com/bucket/upload-signed-url',
      objectUrl: 'https://storage.googleapis.com/bucket/vehicle-photos/uuid.jpg',
    }),
  };
}

describe('RequestPhotoUploadSessionHandler', () => {
  it('genera una sesión de carga y retorna uploadUrl y objectUrl', async () => {
    const storage = buildStoragePort();
    const { access, workContext } = buildFleetAccessService('CAMPO');
    const handler = new RequestPhotoUploadSessionHandler(storage as any, access);

    const result = await handler.execute({
      firebaseUid: 'uid-1',
      companyId: COMPANY,
      branchId: BRANCH,
      contentType: 'image/jpeg',
      contentLength: 500_000,
    });

    expect(workContext.authorize).toHaveBeenCalledWith({
      firebaseUid: 'uid-1',
      companyId: COMPANY,
      branchId: BRANCH,
    });
    expect(storage.generateSignedUploadUrl).toHaveBeenCalledWith({
      companyId: COMPANY,
      contentType: 'image/jpeg',
    });
    expect(result.uploadUrl).toContain('storage.googleapis.com');
    expect(result.objectUrl).toContain('storage.googleapis.com');
  });

  it('lanza PayloadTooLargeException cuando contentLength supera 12 MB', async () => {
    const storage = buildStoragePort();
    const { access } = buildFleetAccessService('CAMPO');
    const handler = new RequestPhotoUploadSessionHandler(storage as any, access);

    await expect(
      handler.execute({
        firebaseUid: 'uid-1',
        companyId: COMPANY,
        branchId: BRANCH,
        contentType: 'image/jpeg',
        contentLength: MAX_PHOTO_BYTES + 1,
      }),
    ).rejects.toThrow(PayloadTooLargeException);

    expect(storage.generateSignedUploadUrl).not.toHaveBeenCalled();
  });

  it('no llama a storage si la autorización falla', async () => {
    const storage = buildStoragePort();
    const { access, workContext } = buildFleetAccessService('CAMPO');
    (workContext.authorize as jest.Mock).mockRejectedValueOnce(new Error('Unauthorized'));
    const handler = new RequestPhotoUploadSessionHandler(storage as any, access);

    await expect(
      handler.execute({
        firebaseUid: 'uid-1',
        companyId: COMPANY,
        branchId: BRANCH,
        contentType: 'image/webp',
        contentLength: 1_000,
      }),
    ).rejects.toThrow('Unauthorized');

    expect(storage.generateSignedUploadUrl).not.toHaveBeenCalled();
  });
});
