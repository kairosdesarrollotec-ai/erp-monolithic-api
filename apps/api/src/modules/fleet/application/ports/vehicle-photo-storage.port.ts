export abstract class VehiclePhotoStoragePort {
  abstract generateSignedUploadUrl(params: {
    companyId: string;
    contentType: 'image/jpeg' | 'image/webp';
  }): Promise<{ uploadUrl: string; objectUrl: string }>;

  abstract generateSignedReadUrl(objectUrl: string): Promise<string>;
}
