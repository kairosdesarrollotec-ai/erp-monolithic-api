import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import {
  AddDamageInput,
  AddEvidenceInput,
  AddImmobilizationChargeInput,
  CreateReturnInput,
  ImmobilizationChargeRecord,
  ListReturnsFilter,
  ReturnDamageRecord,
  ReturnEvidenceCounts,
  ReturnEvidenceRecord,
  ReturnRecord,
  ReturnRepositoryPort,
  ReturnScope,
  UpdateReturnInput,
} from '../../application/ports/return-repository.port';
import {
  RentalAlreadyHasActiveReturnError,
  ReturnNotFoundError,
  ReturnVersionConflictError,
} from '../../domain/return-errors';
import { RETURN_INCLUDE, toReturnRecord } from './return-persistence.mapper';
import { PrismaReturnDamagePersistence } from './prisma-return-damage.persistence';
import { PrismaImmobilizationChargePersistence } from './prisma-immobilization-charge.persistence';
import { PrismaReturnEvidencePersistence } from './prisma-return-evidence.persistence';

function scopeWhere(id: string, scope: ReturnScope): Prisma.RentalReturnWhereInput {
  return {
    id,
    organizationId: scope.organizationId,
    operatingCompanyId: scope.operatingCompanyId,
    branchId: scope.branchId,
  };
}

@Injectable()
export class PrismaReturnRepository implements ReturnRepositoryPort {
  constructor(
    private readonly prisma: PrismaService,
    private readonly damagePersistence: PrismaReturnDamagePersistence,
    private readonly chargePersistence: PrismaImmobilizationChargePersistence,
    private readonly evidencePersistence: PrismaReturnEvidencePersistence,
  ) {}

  async create(input: CreateReturnInput, tx?: Prisma.TransactionClient): Promise<ReturnRecord> {
    const client = tx ?? this.prisma;
    try {
      const created = await client.rentalReturn.create({
        data: {
          organizationId: input.organizationId,
          operatingCompanyId: input.operatingCompanyId,
          branchId: input.branchId,
          rentalId: input.rentalId,
          vehicleId: input.vehicleId,
          customerId: input.customerId,
          scheduledAt: input.scheduledAt,
          status: input.status,
          custodyHolder: input.custodyHolder,
          customerPresent: input.customerPresent,
          mileageAtReturn: input.mileageAtReturn,
          fuelLevelAtReturn: input.fuelLevelAtReturn,
          receivedAt: input.receivedAt,
          notes: input.notes,
          createdBy: input.createdBy,
          updatedBy: input.createdBy,
        },
        include: RETURN_INCLUDE,
      });
      return toReturnRecord(created);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new RentalAlreadyHasActiveReturnError(input.rentalId);
      }
      throw err;
    }
  }

  async findById(id: string, scope: ReturnScope, tx?: Prisma.TransactionClient): Promise<ReturnRecord | null> {
    const client = tx ?? this.prisma;
    const found = await client.rentalReturn.findFirst({
      where: scopeWhere(id, scope),
      include: RETURN_INCLUDE,
    });
    return found ? toReturnRecord(found) : null;
  }

  async findByRentalId(
    rentalId: string,
    scope: ReturnScope,
    tx?: Prisma.TransactionClient,
  ): Promise<ReturnRecord | null> {
    const client = tx ?? this.prisma;
    const found = await client.rentalReturn.findFirst({
      where: {
        rentalId,
        organizationId: scope.organizationId,
        operatingCompanyId: scope.operatingCompanyId,
        branchId: scope.branchId,
      },
      include: RETURN_INCLUDE,
    });
    return found ? toReturnRecord(found) : null;
  }

  /** Optimistic concurrency: `version` esperado o ReturnVersionConflictError; siempre incrementa la versión. */
  async update(input: UpdateReturnInput, tx?: Prisma.TransactionClient): Promise<ReturnRecord> {
    const client = tx ?? this.prisma;
    const result = await client.rentalReturn.updateMany({
      where: { ...scopeWhere(input.id, input.scope), version: input.expectedVersion },
      data: {
        status: input.status,
        custodyHolder: input.custodyHolder,
        customerPresent: input.customerPresent,
        mileageAtReturn: input.mileageAtReturn,
        fuelLevelAtReturn: input.fuelLevelAtReturn,
        alcoholTestResult: input.alcoholTestResult,
        alcoholTestNotes: input.alcoholTestNotes,
        alcoholEscalationDecision: input.alcoholEscalationDecision,
        alcoholEscalationMarkedRed: input.alcoholEscalationMarkedRed,
        alcoholEscalationNotes: input.alcoholEscalationNotes,
        alcoholEscalationDecidedById: input.alcoholEscalationDecidedById,
        alcoholEscalationDecidedAt: input.alcoholEscalationDecidedAt,
        responsibilitySignerName: input.responsibilitySignerName,
        responsibilitySignerIsHolder: input.responsibilitySignerIsHolder,
        responsibilitySignerRelation: input.responsibilitySignerRelation,
        responsibilitySignatureData: input.responsibilitySignatureData,
        responsibilitySignedAt: input.responsibilitySignedAt,
        receivedAt: input.receivedAt,
        inspectedAt: input.inspectedAt,
        closedAt: input.closedAt,
        finalSettlementAmount: input.finalSettlementAmount,
        notes: input.notes,
        updatedBy: input.updatedBy,
        version: { increment: 1 },
      },
    });

    if (result.count === 0) {
      const exists = await client.rentalReturn.findFirst({
        where: scopeWhere(input.id, input.scope),
        select: { id: true },
      });
      throw exists ? new ReturnVersionConflictError() : new ReturnNotFoundError(input.id);
    }

    const updated = await client.rentalReturn.findFirstOrThrow({
      where: scopeWhere(input.id, input.scope),
      include: RETURN_INCLUDE,
    });
    return toReturnRecord(updated);
  }

  async list(filter: ListReturnsFilter): Promise<ReturnRecord[]> {
    const where: Prisma.RentalReturnWhereInput = {
      organizationId: filter.organizationId,
      operatingCompanyId: filter.operatingCompanyId,
      branchId: filter.branchId,
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.cursor
        ? {
            OR: [
              { createdAt: { lt: filter.cursor.createdAt } },
              { createdAt: filter.cursor.createdAt, id: { lt: filter.cursor.id } },
            ],
          }
        : {}),
    };

    const rows = await this.prisma.rentalReturn.findMany({
      where,
      take: filter.limit,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: RETURN_INCLUDE,
    });
    return rows.map(toReturnRecord);
  }

  addDamage(input: AddDamageInput, tx?: Prisma.TransactionClient): Promise<ReturnDamageRecord> {
    return this.damagePersistence.add(input, tx);
  }

  addImmobilizationCharge(
    input: AddImmobilizationChargeInput,
    tx?: Prisma.TransactionClient,
  ): Promise<ImmobilizationChargeRecord> {
    return this.chargePersistence.add(input, tx);
  }

  addEvidence(input: AddEvidenceInput, tx?: Prisma.TransactionClient): Promise<ReturnEvidenceRecord> {
    return this.evidencePersistence.add(input, tx);
  }

  listEvidences(returnId: string, scope: ReturnScope): Promise<ReturnEvidenceRecord[]> {
    return this.evidencePersistence.list(returnId, scope);
  }

  countEvidenceByType(
    returnId: string,
    scope: ReturnScope,
    tx?: Prisma.TransactionClient,
  ): Promise<ReturnEvidenceCounts> {
    return this.evidencePersistence.countByType(returnId, scope, tx);
  }
}
