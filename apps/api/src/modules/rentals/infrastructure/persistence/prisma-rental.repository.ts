import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import {
  RentalRepositoryPort,
  RentalRecord,
  RentalScope,
  CreateRentalInput,
  ListRentalsFilter,
  RegisterAlcoholTestInput,
  SaveNotaryEvaluationInput,
  ApproveNotaryExceptionInput,
  FormalizeContractInput,
  CompleteDeliveryInput,
  RentalExtensionRecord,
  RequestExtensionInput,
  AuthorizeExtensionInput,
  RejectExtensionInput,
  ContractTemplateRecord,
  CreateContractTemplateInput,
  ReportExtensionBreachInput,
} from '../../application/ports/rental-repository.port';
import { RentalStatus } from '../../domain/rental-status';
import { RentalVersionConflictError } from '../../domain/rental-errors';
import {
  toRentalRecord,
  RentalWithRelations,
} from './rental-persistence.mapper';
import { PrismaContractTemplatePersistence } from './prisma-contract-template.persistence';
import { PrismaRentalExtensionPersistence } from './prisma-rental-extension.persistence';
import { PrismaRentalNotaryContractPersistence } from './prisma-rental-notary-contract.persistence';

function scopeWhere(id: string, scope: RentalScope) {
  return {
    id,
    organizationId: scope.organizationId,
    operatingCompanyId: scope.operatingCompanyId,
    branchId: scope.branchId,
  };
}

const RENTAL_RELATIONS_INCLUDE = {
  customer: true,
  vehicle: true,
  parties: true,
  notaryEvaluation: true,
  contract: true,
  deposit: true,
} as const;

@Injectable()
export class PrismaRentalRepository implements RentalRepositoryPort {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contractTemplatePersistence: PrismaContractTemplatePersistence,
    private readonly rentalExtensionPersistence: PrismaRentalExtensionPersistence,
    private readonly rentalNotaryContractPersistence: PrismaRentalNotaryContractPersistence,
  ) {}

  async create(input: CreateRentalInput, tx?: Prisma.TransactionClient): Promise<RentalRecord> {
    const client = tx ?? this.prisma;
    try {
      const created = await client.rental.create({
        data: {
          organizationId: input.organizationId,
          operatingCompanyId: input.operatingCompanyId,
          branchId: input.branchId,
          customerId: input.customerId,
          vehicleId: input.vehicleId,
          planCode: input.planCode ?? 'NORMAL',
          startAt: input.startAt,
          expectedEndAt: input.expectedEndAt,
          reservationId: input.reservationId,
          inquiryId: input.inquiryId,
          createdBy: input.createdBy,
          updatedBy: input.createdBy,
          parties: {
            create: {
              customerId: input.customerId,
              role: 'SIGNER',
            },
          },
        },
        include: RENTAL_RELATIONS_INCLUDE,
      });

      return toRentalRecord(created as RentalWithRelations);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException({
          code: 'RENTAL_ALREADY_EXISTS_FOR_RESERVATION',
          detail: 'Ya existe un alquiler asociado a esta reserva.',
        });
      }
      throw err;
    }
  }

  async findById(id: string, scope: RentalScope, tx?: Prisma.TransactionClient): Promise<RentalRecord | null> {
    const client = tx ?? this.prisma;
    const found = await client.rental.findFirst({
      where: scopeWhere(id, scope),
      include: RENTAL_RELATIONS_INCLUDE,
    });

    return found ? toRentalRecord(found as RentalWithRelations) : null;
  }

  async findCustomerById(id: string): Promise<{
    id: string;
    organizationId: string;
    operatingCompanyId: string;
    fullName: string;
    documentNumber: string;
    isBiometricVerified?: boolean;
  } | null> {
    return this.prisma.customer.findUnique({
      where: { id },
      select: {
        id: true,
        organizationId: true,
        operatingCompanyId: true,
        fullName: true,
        documentNumber: true,
      },
    });
  }

  async findVehicleById(id: string): Promise<{
    id: string;
    organizationId: string;
    operatingCompanyId: string;
    plate: string;
    brand: string;
    model: string;
    status: string;
  } | null> {
    return this.prisma.vehicle.findUnique({
      where: { id },
      select: {
        id: true,
        organizationId: true,
        operatingCompanyId: true,
        plate: true,
        brand: true,
        model: true,
        status: true,
      },
    });
  }

  async findReservationById(id: string): Promise<{
    id: string;
    organizationId: string;
    operatingCompanyId: string;
    branchId: string;
    customerId: string;
    vehicleId: string;
    status: string;
    startAt: Date;
    endAt: Date;
  } | null> {
    return this.prisma.reservation.findUnique({
      where: { id },
      select: {
        id: true,
        organizationId: true,
        operatingCompanyId: true,
        branchId: true,
        customerId: true,
        vehicleId: true,
        status: true,
        startAt: true,
        endAt: true,
      },
    });
  }

  async countPreviousRentalsByCustomer(customerId: string, operatingCompanyId: string): Promise<number> {
    return this.prisma.rental.count({
      where: {
        customerId,
        operatingCompanyId,
        status: 'CLOSED',
      },
    });
  }

  async findActiveContractTemplate(companyId: string, type: string): Promise<{ id: string; version: number } | null> {
    return this.contractTemplatePersistence.findActive(companyId, type);
  }

  async contractTemplateBelongsToCompany(templateVersionId: string, companyId: string): Promise<boolean> {
    return this.contractTemplatePersistence.belongsToCompany(templateVersionId, companyId);
  }

  async createContractTemplate(
    input: CreateContractTemplateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<ContractTemplateRecord> {
    return this.contractTemplatePersistence.create(input, tx);
  }

  async listContractTemplates(companyId: string): Promise<ContractTemplateRecord[]> {
    return this.contractTemplatePersistence.list(companyId);
  }

  async list(filter: ListRentalsFilter): Promise<RentalRecord[]> {
    const where: Prisma.RentalWhereInput = {
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

    const results = await this.prisma.rental.findMany({
      where,
      take: filter.limit,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: RENTAL_RELATIONS_INCLUDE,
    });

    return results.map((r) => toRentalRecord(r as RentalWithRelations));
  }

  async transitionStatus(
    id: string,
    scope: RentalScope,
    newStatus: RentalStatus,
    expectedVersion: number,
    updatedBy: string,
    tx?: Prisma.TransactionClient,
  ): Promise<RentalRecord> {
    return this.bumpVersion(
      id,
      scope,
      expectedVersion,
      { status: newStatus, updatedBy },
      tx,
    );
  }

  async saveAlcoholTest(
    input: RegisterAlcoholTestInput,
    tx?: Prisma.TransactionClient,
  ): Promise<RentalRecord> {
    const isPassing = input.result === 'FAVORABLE';
    const newStatus: RentalStatus = isPassing ? 'NOTARY_EVALUATION' : 'CANCELLED';

    return this.bumpVersion(
      input.id,
      input.scope,
      input.expectedVersion,
      {
        alcoholTestResult: input.result,
        status: newStatus,
        updatedBy: input.updatedBy,
      },
      tx,
    );
  }

  async saveNotaryEvaluation(
    input: SaveNotaryEvaluationInput,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    return this.rentalNotaryContractPersistence.saveNotaryEvaluation(input, tx);
  }

  async approveNotaryException(
    input: ApproveNotaryExceptionInput,
    tx?: Prisma.TransactionClient,
  ): Promise<RentalRecord> {
    await this.rentalNotaryContractPersistence.approveNotaryException(input, tx);

    return this.bumpVersion(
      input.id,
      input.scope,
      input.expectedVersion,
      {
        status: 'CONTRACTING',
        updatedBy: input.updatedBy,
      },
      tx,
    );
  }

  async formalizeContract(
    input: FormalizeContractInput,
    tx?: Prisma.TransactionClient,
  ): Promise<RentalRecord> {
    await this.rentalNotaryContractPersistence.formalizeContractAndDeposit(input, tx);

    return this.bumpVersion(
      input.rentalId,
      input.scope,
      input.expectedVersion,
      {
        status: 'PENDING_DELIVERY',
        updatedBy: input.updatedBy,
      },
      tx,
    );
  }

  async completeDelivery(
    input: CompleteDeliveryInput,
    tx?: Prisma.TransactionClient,
  ): Promise<RentalRecord> {
    return this.bumpVersion(
      input.rentalId,
      input.scope,
      input.expectedVersion,
      {
        status: 'ACTIVE',
        startAt: new Date(),
        updatedBy: input.updatedBy,
      },
      tx,
    );
  }

  async findPendingExtensionByRentalId(
    rentalId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<RentalExtensionRecord | null> {
    return this.rentalExtensionPersistence.findPendingByRentalId(rentalId, tx);
  }

  async findVehicleCommitmentOverlap(
    vehicleId: string,
    organizationId: string,
    excludeSourceType: string,
    excludeSourceId: string,
    startsAt: Date,
    endsAt: Date,
  ): Promise<boolean> {
    return this.rentalExtensionPersistence.findVehicleCommitmentOverlap(
      vehicleId,
      organizationId,
      excludeSourceType,
      excludeSourceId,
      startsAt,
      endsAt,
    );
  }

  async requestExtension(
    input: RequestExtensionInput,
    tx?: Prisma.TransactionClient,
  ): Promise<RentalRecord> {
    await this.rentalExtensionPersistence.createPending(input, tx);

    return this.bumpVersion(
      input.rentalId,
      input.scope,
      input.expectedVersion,
      { status: 'EXTENSION_PENDING', updatedBy: input.updatedBy },
      tx,
    );
  }

  async authorizeExtension(
    input: AuthorizeExtensionInput,
    tx?: Prisma.TransactionClient,
  ): Promise<RentalRecord> {
    const { requestedEndAt } = await this.rentalExtensionPersistence.authorize(input, tx);

    return this.bumpVersion(
      input.rentalId,
      input.scope,
      input.expectedVersion,
      {
        status: 'ACTIVE',
        expectedEndAt: requestedEndAt,
        updatedBy: input.updatedBy,
      },
      tx,
    );
  }

  async rejectExtension(
    input: RejectExtensionInput,
    tx?: Prisma.TransactionClient,
  ): Promise<RentalRecord> {
    await this.rentalExtensionPersistence.reject(input, tx);

    return this.bumpVersion(
      input.rentalId,
      input.scope,
      input.expectedVersion,
      { status: 'ACTIVE', updatedBy: input.updatedBy },
      tx,
    );
  }

  async reportExtensionBreach(
    input: ReportExtensionBreachInput,
    tx?: Prisma.TransactionClient,
  ): Promise<RentalRecord> {
    await this.rentalExtensionPersistence.processBreach(input, tx);

    return this.bumpVersion(
      input.rentalId,
      input.scope,
      input.expectedVersion,
      { updatedBy: input.updatedBy },
      tx,
    );
  }

  private async bumpVersion(
    id: string,
    scope: RentalScope,
    expectedVersion: number,
    data: Prisma.RentalUpdateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<RentalRecord> {
    const client = tx ?? this.prisma;
    const result = await client.rental.updateMany({
      where: { ...scopeWhere(id, scope), version: expectedVersion },
      data: { ...data, version: { increment: 1 } },
    });

    if (result.count === 0) {
      throw new RentalVersionConflictError();
    }

    const updated = await client.rental.findFirstOrThrow({
      where: scopeWhere(id, scope),
      include: RENTAL_RELATIONS_INCLUDE,
    });

    return toRentalRecord(updated as RentalWithRelations);
  }
}
