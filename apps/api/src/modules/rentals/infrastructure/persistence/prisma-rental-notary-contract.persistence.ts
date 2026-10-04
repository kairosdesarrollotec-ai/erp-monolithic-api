import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import {
  FormalizeContractInput,
  SaveNotaryEvaluationInput,
  ApproveNotaryExceptionInput,
} from '../../application/ports/rental-repository.port';

@Injectable()
export class PrismaRentalNotaryContractPersistence {
  constructor(private readonly prisma: PrismaService) {}

  async saveNotaryEvaluation(
    input: SaveNotaryEvaluationInput,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx ?? this.prisma;
    await client.notaryEvaluation.upsert({
      where: { rentalId: input.rentalId },
      create: {
        rentalId: input.rentalId,
        policyVersion: input.policyVersion,
        result: input.result,
        reason: input.reason,
        approvedBy: input.approvedBy,
        justification: input.justification,
      },
      update: {
        policyVersion: input.policyVersion,
        result: input.result,
        reason: input.reason,
        approvedBy: input.approvedBy,
        justification: input.justification,
      },
    });
  }

  async approveNotaryException(
    input: ApproveNotaryExceptionInput,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx ?? this.prisma;
    await client.notaryEvaluation.upsert({
      where: { rentalId: input.id },
      create: {
        rentalId: input.id,
        policyVersion: 1,
        result: 'THIRD_PATH_ELIGIBLE',
        reason: 'Excepción notarial autorizada por Gerencia',
        approvedBy: input.approvedBy,
        justification: input.justification,
      },
      update: {
        result: 'THIRD_PATH_ELIGIBLE',
        approvedBy: input.approvedBy,
        justification: input.justification,
      },
    });
  }

  async formalizeContractAndDeposit(
    input: FormalizeContractInput,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx ?? this.prisma;

    await client.rentalContract.upsert({
      where: { rentalId: input.rentalId },
      create: {
        rentalId: input.rentalId,
        templateVersionId: input.templateVersionId,
        documentRef: input.documentRef,
        status: 'SIGNED',
        signedAt: new Date(),
        signatureData: input.signatureData ?? null,
      },
      update: {
        templateVersionId: input.templateVersionId,
        documentRef: input.documentRef,
        status: 'SIGNED',
        signedAt: new Date(),
        signatureData: input.signatureData ?? null,
      },
    });

    await client.rentalDeposit.upsert({
      where: { rentalId: input.rentalId },
      create: {
        rentalId: input.rentalId,
        originalAmount: new Prisma.Decimal(input.depositAmount),
        currency: input.currency,
        status: 'HELD',
      },
      update: {
        originalAmount: new Prisma.Decimal(input.depositAmount),
        currency: input.currency,
        status: 'HELD',
      },
    });
  }
}
