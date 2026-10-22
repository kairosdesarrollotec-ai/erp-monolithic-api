import type { Prisma } from '@prisma/client';
import { RentalScope } from './rental-repository.port';

export type RentalEvidenceKind = 'PHOTO' | 'VIDEO';

export interface RentalEvidenceRecord {
  id: string;
  rentalId: string;
  type: RentalEvidenceKind;
  zone: string;
  objectUrl: string;
  uploadedBy: string;
  uploadedAt: Date;
}

export interface RecordRentalEvidenceInput {
  rentalId: string;
  scope: RentalScope;
  type: RentalEvidenceKind;
  zone: string;
  objectUrl: string;
  uploadedBy: string;
}

export interface RentalEvidenceCounts {
  photos: number;
  videos: number;
}

/**
 * ALQ-09 / BR-INS-003 / BR-INS-004 - persistencia de evidencia real (foto/
 * video) del checklist de entrega. Ver nota en el modelo Prisma
 * `RentalEvidence`: no existe aun una tabla transversal `evidence`, por lo
 * que esto es especifico de Rentals.
 */
export abstract class RentalEvidenceRepositoryPort {
  abstract record(
    input: RecordRentalEvidenceInput,
    tx?: Prisma.TransactionClient,
  ): Promise<RentalEvidenceRecord>;

  abstract countByType(
    rentalId: string,
    scope: RentalScope,
    tx?: Prisma.TransactionClient,
  ): Promise<RentalEvidenceCounts>;

  abstract list(rentalId: string, scope: RentalScope): Promise<RentalEvidenceRecord[]>;

  /** Elimina una evidencia del alquiler dentro del scope; devuelve false si no existia. */
  abstract delete(rentalId: string, evidenceId: string, scope: RentalScope, tx?: Prisma.TransactionClient): Promise<boolean>;
}
