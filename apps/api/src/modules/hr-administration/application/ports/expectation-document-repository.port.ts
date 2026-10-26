import type { ExpectationDocument, Prisma } from '@prisma/client';

export interface UpsertExpectationDocumentData {
  organizationId: string;
  operatingCompanyId: string;
  employeeId: string;
  status: string;
  deadlineDate: Date;
  fileUrl?: string | null;
  signedAt?: Date | null;
  registeredBy: string;
  signedRegisteredBy?: string | null;
  notes?: string | null;
}

export abstract class ExpectationDocumentRepositoryPort {
  abstract findByEmployeeId(
    employeeId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<ExpectationDocument | null>;

  abstract upsert(
    data: UpsertExpectationDocumentData,
    tx?: Prisma.TransactionClient,
  ): Promise<ExpectationDocument>;
}
