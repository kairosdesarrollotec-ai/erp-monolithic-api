export class RentalEvidenceResponse {
  id!: string;
  rentalId!: string;
  type!: 'PHOTO' | 'VIDEO';
  zone!: string;
  objectUrl!: string;
  uploadedBy!: string;
  uploadedAt!: string;
}
