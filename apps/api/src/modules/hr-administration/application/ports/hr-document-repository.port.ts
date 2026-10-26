import type { HrDocumentRead, HrDocumentVersion, Prisma } from '@prisma/client';

export interface HrDocumentWithCurrentVersion {
  id: string; // documentId
  organizationId: string;
  operatingCompanyId: string;
  code: string;
  title: string;
  category: string;
  createdAt: Date;
  updatedAt: Date;
  currentVersion: HrDocumentVersion;
}

export interface PublishDocumentData {
  organizationId: string;
  operatingCompanyId: string;
  code: string;
  title: string;
  category: string;
  fileUrl: string;
  fileHash?: string | null;
  fileName?: string | null;
  mimeType?: string;
  sizeBytes?: number | null;
  publishedBy: string;
}

export abstract class HrDocumentRepositoryPort {
  abstract publishVersion(data: PublishDocumentData, tx?: Prisma.TransactionClient): Promise<HrDocumentWithCurrentVersion>;
  abstract findByCode(companyId: string, code: string, tx?: Prisma.TransactionClient): Promise<HrDocumentWithCurrentVersion | null>;
  abstract findActiveById(id: string, companyId: string, tx?: Prisma.TransactionClient): Promise<HrDocumentWithCurrentVersion | null>;
  abstract listActive(companyId: string, category?: string): Promise<HrDocumentWithCurrentVersion[]>;
  abstract recordRead(input: {
    documentVersionId: string;
    employeeId: string;
    companyId: string;
    organizationId: string;
    readByUid: string;
  }, tx?: Prisma.TransactionClient): Promise<HrDocumentRead>;
  abstract findReadsByEmployee(employeeId: string): Promise<HrDocumentRead[]>;
}
