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
  SetCompanyDriverDailyRateInput,
  AddAuthorizedDriverInput,
  CompleteDeliveryInput,
  RentalExtensionRecord,
  RequestExtensionInput,
  AuthorizeExtensionInput,
  RejectExtensionInput,
  ReportExtensionBreachInput,
  RentalInquiryRecord,
} from '../../application/ports/rental-repository.port';
import { RentalStatus } from '../../domain/rental-status';
import type { ReservationCreditSource } from '../../domain/reservation-credit';
import { RentalVersionConflictError } from '../../domain/rental-errors';
import {
  toRentalRecord,
  RentalWithRelations,
} from './rental-persistence.mapper';
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

  async findCustomerById(id: string, tx?: Prisma.TransactionClient): Promise<{
    id: string;
    organizationId: string;
    operatingCompanyId: string;
    fullName: string;
    documentNumber: string;
    documentType?: string;
    status: string;
    isBiometricVerified?: boolean;
  } | null> {
    const client = tx ?? this.prisma;
    return client.customer.findUnique({
      where: { id },
      select: {
        id: true,
        organizationId: true,
        operatingCompanyId: true,
        fullName: true,
        documentNumber: true,
        documentType: true,
        status: true,
      },
    });
  }

  async findVehicleById(id: string, tx?: Prisma.TransactionClient): Promise<{
    id: string;
    organizationId: string;
    operatingCompanyId: string;
    branchId: string | null;
    plate: string;
    brand: string;
    model: string;
    status: string;
  } | null> {
    const client = tx ?? this.prisma;
    return client.vehicle.findUnique({
      where: { id },
      select: {
        id: true,
        organizationId: true,
        operatingCompanyId: true,
        branchId: true,
        plate: true,
        brand: true,
        model: true,
        status: true,
      },
    });
  }

  async findInquiryForRental(id: string, organizationId: string, tx?: Prisma.TransactionClient): Promise<RentalInquiryRecord | null> {
    const client = tx ?? this.prisma;
    const row = await client.inquiry.findUnique({
      where: { id, organizationId },
      select: {
        id: true,
        organizationId: true,
        operatingCompanyId: true,
        branchId: true,
        customerId: true,
        status: true,
        quotations: {
          orderBy: { createdAt: 'desc' },
          select: { id: true, vehicleId: true, estimatedDays: true, validUntil: true, createdAt: true },
        },
      },
    });
    return row;
  }

  async hasBlockingVehicleCommitment(
    vehicleId: string,
    organizationId: string,
    startsAt: Date,
    endsAt: Date,
    tx?: Prisma.TransactionClient,
  ): Promise<boolean> {
    const client = tx ?? this.prisma;
    const overlap = await client.vehicleCommitment.findFirst({
      where: {
        vehicleId,
        organizationId,
        status: { in: ['ACTIVE', 'CONSOLIDATED'] },
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
      select: { id: true },
    });
    return overlap !== null;
  }

  async findReservationCreditSource(
    reservationId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<ReservationCreditSource | null> {
    const client = tx ?? this.prisma;
    const row = await client.reservation.findUnique({
      where: { id: reservationId },
      select: {
        id: true,
        status: true,
        requiredPaymentAmount: true,
        currency: true,
        paymentValidatedAt: true,
      },
    });
    if (!row) return null;
    return {
      reservationId: row.id,
      status: row.status,
      amount: row.requiredPaymentAmount.toString(),
      currency: row.currency,
      paymentValidatedAt: row.paymentValidatedAt,
    };
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

  async markReservationConverted(
    reservationId: string,
    scope: RentalScope,
    tx: Prisma.TransactionClient,
  ): Promise<boolean> {
    const result = await tx.reservation.updateMany({
      where: { ...scopeWhere(reservationId, scope), status: 'CONFIRMED' },
      data: { status: 'CONVERTED', version: { increment: 1 } },
    });
    return result.count === 1;
  }

  async transferReservationCommitmentToRental(
    reservationId: string,
    rentalId: string,
    tx: Prisma.TransactionClient,
  ): Promise<number> {
    const result = await tx.vehicleCommitment.updateMany({
      where: { sourceType: 'RESERVATION', sourceId: reservationId, status: { in: ['ACTIVE', 'CONSOLIDATED'] } },
      data: { sourceType: 'RENTAL', sourceId: rentalId },
    });
    return result.count;
  }

  async findByReservationId(
    reservationId: string,
    scope: RentalScope,
    tx?: Prisma.TransactionClient,
  ): Promise<RentalRecord | null> {
    const client = tx ?? this.prisma;
    const found = await client.rental.findFirst({
      where: {
        reservationId,
        organizationId: scope.organizationId,
        operatingCompanyId: scope.operatingCompanyId,
        branchId: scope.branchId,
      },
      include: RENTAL_RELATIONS_INCLUDE,
    });
    return found ? toRentalRecord(found as RentalWithRelations) : null;
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

  async addAuthorizedDriver(
    input: AddAuthorizedDriverInput,
    tx?: Prisma.TransactionClient,
  ): Promise<RentalRecord> {
    const client = tx ?? this.prisma;
    await client.rentalParty.create({
      data: {
        rentalId: input.rentalId,
        customerId: input.customerId,
        role: input.role ?? 'DRIVER',
        addendumDocumentRef: input.addendumDocumentRef,
      },
    });
    return this.bumpVersion(input.rentalId, input.scope, input.expectedVersion, { updatedBy: input.updatedBy }, tx);
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

  async setCompanyDriverDailyRate(
    input: SetCompanyDriverDailyRateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<RentalRecord> {
    return this.bumpVersion(
      input.rentalId,
      input.scope,
      input.expectedVersion,
      { companyDriverDailyRate: input.dailyRate, updatedBy: input.updatedBy },
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
        // Solo alquiler directo: el origen Reserva conserva las fechas acordadas.
        ...(input.startAt ? { startAt: input.startAt } : {}),
        ...(input.expectedEndAt ? { expectedEndAt: input.expectedEndAt } : {}),
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

  async listExtensionsByRentalId(
    rentalId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<RentalExtensionRecord[]> {
    return this.rentalExtensionPersistence.listByRentalId(rentalId, tx);
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

    // La falta grave resuelve la ampliacion (BREACH): el alquiler vuelve a
    // ACTIVE para que el vehiculo pueda recuperarse por Devolucion (que solo
    // acepta ACTIVE/RETURN_IN_PROGRESS). Antes quedaba atascado en
    // EXTENSION_PENDING sin ampliacion pendiente que resolver.
    return this.bumpVersion(
      input.rentalId,
      input.scope,
      input.expectedVersion,
      { status: 'ACTIVE', updatedBy: input.updatedBy },
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
