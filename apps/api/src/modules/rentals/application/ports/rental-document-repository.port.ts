import type { Prisma } from '@prisma/client';
import { RentalScope } from './rental-repository.port';
import { RentalDocumentType } from './rental-document-storage.port';

export interface RentalDocumentRecord {
  id: string;
  rentalId: string;
  documentType: RentalDocumentType;
  objectUrl: string;
  createdAt: Date;
}

export interface RecordRentalDocumentInput {
  rentalId: string;
  scope: RentalScope;
  documentType: RentalDocumentType;
  objectUrl: string;
}

export abstract class RentalDocumentRepositoryPort {
  abstract record(
    input: RecordRentalDocumentInput,
    tx?: Prisma.TransactionClient,
  ): Promise<RentalDocumentRecord>;

  abstract list(rentalId: string, scope: RentalScope): Promise<RentalDocumentRecord[]>;
}
