import { RentalEvidenceKind } from './rental-evidence-repository.port';

export type RentalEvidenceContentType = 'image/jpeg' | 'image/webp' | 'video/mp4' | 'video/webm';

/**
 * ALQ-09 - mismo patron de URL firmada de GCS ya usado por Fleet
 * (VehiclePhotoStoragePort / GcsVehiclePhotoService), adaptado para
 * admitir fotos y videos del checklist de entrega de un alquiler.
 */
export abstract class RentalEvidenceStoragePort {
  abstract generateSignedUploadUrl(params: {
    companyId: string;
    rentalId: string;
    type: RentalEvidenceKind;
    zone: string;
    contentType: RentalEvidenceContentType;
  }): Promise<{ uploadUrl: string; objectUrl: string }>;
}
