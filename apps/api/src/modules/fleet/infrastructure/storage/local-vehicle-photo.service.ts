import { Injectable } from '@nestjs/common';
import { VehiclePhotoStoragePort } from '../../application/ports/vehicle-photo-storage.port';
import { LocalStorageService, getLocalStorageService } from '../../../../common/storage/local-storage.service';

/** Driver local (solo desarrollo) de GcsVehiclePhotoService: misma clave de objeto. */
@Injectable()
export class LocalVehiclePhotoService implements VehiclePhotoStoragePort {
  constructor(private readonly storage: LocalStorageService = getLocalStorageService()) {}

  async generateSignedUploadUrl(params: {
    companyId: string;
    contentType: 'image/jpeg' | 'image/webp';
  }): Promise<{ uploadUrl: string; objectUrl: string }> {
    const ext = params.contentType === 'image/webp' ? 'webp' : 'jpg';
    const key = `vehicle-photos/${params.companyId}/${crypto.randomUUID()}.${ext}`;
    const { uploadUrl, objectUrl } = this.storage.createUploadUrl(key, params.contentType);
    return { uploadUrl, objectUrl };
  }

  async generateSignedReadUrl(objectUrl: string): Promise<string> {
    return this.storage.createReadUrl(objectUrl);
  }
}
