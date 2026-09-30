import { Injectable, PayloadTooLargeException } from '@nestjs/common';
import { VehiclePhotoStoragePort } from '../ports/vehicle-photo-storage.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';

const MAX_PHOTO_BYTES = 12 * 1024 * 1024; // 12 MB — SDD-00 §16.5

export interface RequestPhotoUploadSessionCommand {
  firebaseUid: string;
  companyId: string;
  branchId: string;
  contentType: 'image/jpeg' | 'image/webp';
  contentLength: number;
}

@Injectable()
export class RequestPhotoUploadSessionHandler {
  constructor(
    private readonly storage: VehiclePhotoStoragePort,
    private readonly authorization: WorkContextAuthorizationService,
  ) {}

  async execute(
    command: RequestPhotoUploadSessionCommand,
  ): Promise<{ uploadUrl: string; objectUrl: string }> {
    await this.authorization.authorize({
      firebaseUid: command.firebaseUid,
      companyId: command.companyId,
      branchId: command.branchId,
    });

    if (command.contentLength > MAX_PHOTO_BYTES) {
      throw new PayloadTooLargeException(
        `El archivo supera el tamaño máximo permitido de 12 MB (recibido: ${command.contentLength} bytes).`,
      );
    }

    return this.storage.generateSignedUploadUrl({
      companyId: command.companyId,
      contentType: command.contentType,
    });
  }
}
