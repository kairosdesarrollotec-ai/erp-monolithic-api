import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import type { ExpectationDocument, Prisma } from '@prisma/client';
import {
  ExpectationDocumentRepositoryPort,
  UpsertExpectationDocumentData,
} from '../../application/ports/expectation-document-repository.port';

@Injectable()
export class PrismaExpectationDocumentRepository implements ExpectationDocumentRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmployeeId(
    employeeId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<ExpectationDocument | null> {
    const client = tx ?? this.prisma;
    return client.expectationDocument.findUnique({
      where: { employeeId },
    });
  }

  async upsert(
    data: UpsertExpectationDocumentData,
    tx?: Prisma.TransactionClient,
  ): Promise<ExpectationDocument> {
    const client = tx ?? this.prisma;
    return client.expectationDocument.upsert({
      where: { employeeId: data.employeeId },
      create: {
        organizationId: data.organizationId,
        operatingCompanyId: data.operatingCompanyId,
        employeeId: data.employeeId,
        status: data.status,
        deadlineDate: data.deadlineDate,
        fileUrl: data.fileUrl ?? null,
        signedAt: data.signedAt ?? null,
        registeredBy: data.registeredBy,
        signedRegisteredBy: data.signedRegisteredBy ?? null,
        notes: data.notes ?? null,
      },
      update: {
        status: data.status,
        fileUrl: data.fileUrl ?? undefined,
        signedAt: data.signedAt ?? undefined,
        signedRegisteredBy: data.signedRegisteredBy ?? undefined,
        notes: data.notes ?? undefined,
      },
    });
  }
}
