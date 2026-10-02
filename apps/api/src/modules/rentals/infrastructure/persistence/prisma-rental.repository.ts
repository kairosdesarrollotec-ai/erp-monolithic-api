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
import { ExtensionStatus } from '../../domain/extension-status';
import { RentalVersionConflictError } from '../../domain/rental-errors';

type RentalWithRelations = Prisma.RentalGetPayload<{
  include: {
    customer: true;
    vehicle: true;
    parties: true;
    notaryEvaluation: true;
    contract: true;
    deposit: true;
  };
}>;

function toRecord(row: RentalWithRelations): RentalRecord {
  return {
    id: row.id,
    organizationId: row.organizationId,
    operatingCompanyId: row.operatingCompanyId,
    branchId: row.branchId,
    inquiryId: row.inquiryId,
    reservationId: row.reservationId,
    customerId: row.customerId,
    customerName: row.customer.fullName,
    customerDocNumber: row.customer.documentNumber,
    vehicleId: row.vehicleId,
    vehiclePlate: row.vehicle.plate,
    vehicleBrand: row.vehicle.brand,
    vehicleModel: row.vehicle.model,
    planCode: row.planCode,
    status: row.status as RentalStatus,
    startAt: row.startAt,
    expectedEndAt: row.expectedEndAt,
    alcoholTestResult: row.alcoholTestResult,
    createdAt: row.createdAt,
    createdBy: row.createdBy,
    updatedAt: row.updatedAt,
    updatedBy: row.updatedBy,
    version: row.version,
    parties: row.parties.map((p) => ({
      id: p.id,
      rentalId: p.rentalId,
      customerId: p.customerId,
      role: p.role as any,
      createdAt: p.createdAt,
    })),
    notaryEvaluation: row.notaryEvaluation
      ? {
          id: row.notaryEvaluation.id,
          rentalId: row.notaryEvaluation.rentalId,
          policyVersion: row.notaryEvaluation.policyVersion,
          result: row.notaryEvaluation.result as any,
          reason: row.notaryEvaluation.reason,
          evaluatedAt: row.notaryEvaluation.evaluatedAt,
          approvedBy: row.notaryEvaluation.approvedBy,
          justification: row.notaryEvaluation.justification,
        }
      : null,
    contract: row.contract
      ? {
          id: row.contract.id,
          rentalId: row.contract.rentalId,
          templateVersionId: row.contract.templateVersionId,
          documentRef: row.contract.documentRef,
          status: row.contract.status,
          signedAt: row.contract.signedAt,
          createdAt: row.contract.createdAt,
        }
      : null,
    deposit: row.deposit
      ? {
          id: row.deposit.id,
          rentalId: row.deposit.rentalId,
          originalAmount: row.deposit.originalAmount.toString(),
          currency: row.deposit.currency,
          status: row.deposit.status,
          createdAt: row.deposit.createdAt,
        }
      : null,
  };
}

function toExtensionRecord(row: {
  id: string;
  rentalId: string;
  requestedEndAt: Date;
  status: string;
  paymentId: string | null;
  addendumDocumentRef: string | null;
  requestedAt: Date;
  resolvedAt: Date | null;
}): RentalExtensionRecord {
  return {
    id: row.id,
    rentalId: row.rentalId,
    requestedEndAt: row.requestedEndAt,
    status: row.status as ExtensionStatus,
    paymentId: row.paymentId,
    addendumDocumentRef: row.addendumDocumentRef,
    requestedAt: row.requestedAt,
    resolvedAt: row.resolvedAt,
  };
}

function scopeWhere(id: string, scope: RentalScope) {
  return {
    id,
    organizationId: scope.organizationId,
    operatingCompanyId: scope.operatingCompanyId,
    branchId: scope.branchId,
  };
}

@Injectable()
export class PrismaRentalRepository implements RentalRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

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
        include: {
          customer: true,
          vehicle: true,
          parties: true,
          notaryEvaluation: true,
          contract: true,
          deposit: true,
        },
      });

      return toRecord(created);
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
      include: {
        customer: true,
        vehicle: true,
        parties: true,
        notaryEvaluation: true,
        contract: true,
        deposit: true,
      },
    });

    return found ? toRecord(found) : null;
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
    return this.prisma.contractTemplate.findFirst({
      where: {
        companyId,
        type,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        version: true,
      },
      orderBy: { version: 'desc' },
    });
  }

  async contractTemplateBelongsToCompany(templateVersionId: string, companyId: string): Promise<boolean> {
    // Tambien exige status ACTIVE: formalize-contract solo acepta un
    // templateVersionId explicito si ademas esta vigente (BR-DOC-002).
    const row = await this.prisma.contractTemplate.findFirst({
      where: { id: templateVersionId, companyId, status: 'ACTIVE' },
      select: { id: true },
    });
    return row !== null;
  }

  async createContractTemplate(
    input: CreateContractTemplateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<ContractTemplateRecord> {
    const client = tx ?? this.prisma;

    const last = await client.contractTemplate.findFirst({
      where: { companyId: input.companyId, type: input.type },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const nextVersion = (last?.version ?? 0) + 1;

    // Retira la version ACTIVE previa (si existe) antes de insertar la
    // nueva: el indice unico parcial "contract_template_unique_active"
    // (BR-DOC-002) solo permite 1 fila ACTIVE por (company_id, type), y
    // dentro de la misma transaccion el UPDATE ya es visible para el
    // INSERT siguiente.
    await client.contractTemplate.updateMany({
      where: { companyId: input.companyId, type: input.type, status: 'ACTIVE' },
      data: { status: 'RETIRED', effectiveTo: new Date() },
    });

    return client.contractTemplate.create({
      data: {
        companyId: input.companyId,
        type: input.type,
        version: nextVersion,
        effectiveFrom: input.effectiveFrom,
        status: 'ACTIVE',
      },
    });
  }

  async listContractTemplates(companyId: string): Promise<ContractTemplateRecord[]> {
    return this.prisma.contractTemplate.findMany({
      where: { companyId },
      orderBy: [{ type: 'asc' }, { version: 'desc' }],
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
      include: {
        customer: true,
        vehicle: true,
        parties: true,
        notaryEvaluation: true,
        contract: true,
        deposit: true,
      },
    });

    return results.map(toRecord);
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
  ): Promise<RentalRecord> {
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
    const client = tx ?? this.prisma;

    await client.rentalContract.upsert({
      where: { rentalId: input.rentalId },
      create: {
        rentalId: input.rentalId,
        templateVersionId: input.templateVersionId,
        documentRef: input.documentRef,
        status: 'SIGNED',
        signedAt: new Date(),
      },
      update: {
        templateVersionId: input.templateVersionId,
        documentRef: input.documentRef,
        status: 'SIGNED',
        signedAt: new Date(),
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
    const client = tx ?? this.prisma;
    const row = await client.rentalExtension.findFirst({
      where: { rentalId, status: 'PENDING' },
      orderBy: { requestedAt: 'desc' },
    });
    return row ? toExtensionRecord(row) : null;
  }

  async findVehicleCommitmentOverlap(
    vehicleId: string,
    organizationId: string,
    excludeSourceType: string,
    excludeSourceId: string,
    startsAt: Date,
    endsAt: Date,
  ): Promise<boolean> {
    const overlap = await this.prisma.vehicleCommitment.findFirst({
      where: {
        vehicleId,
        organizationId,
        status: 'ACTIVE',
        NOT: { sourceType: excludeSourceType, sourceId: excludeSourceId },
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
    });
    return overlap !== null;
  }

  async requestExtension(
    input: RequestExtensionInput,
    tx?: Prisma.TransactionClient,
  ): Promise<RentalRecord> {
    const client = tx ?? this.prisma;

    await client.rentalExtension.create({
      data: {
        rentalId: input.rentalId,
        requestedEndAt: input.requestedEndAt,
        status: 'PENDING',
      },
    });

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
    const client = tx ?? this.prisma;

    const extension = await client.rentalExtension.findUniqueOrThrow({
      where: { id: input.extensionId },
    });

    await client.rentalExtension.update({
      where: { id: input.extensionId },
      data: {
        status: 'AUTHORIZED',
        paymentId: input.paymentId,
        addendumDocumentRef: input.addendumDocumentRef,
        resolvedAt: new Date(),
      },
    });

    return this.bumpVersion(
      input.rentalId,
      input.scope,
      input.expectedVersion,
      {
        status: 'ACTIVE',
        expectedEndAt: extension.requestedEndAt,
        updatedBy: input.updatedBy,
      },
      tx,
    );
  }

  async rejectExtension(
    input: RejectExtensionInput,
    tx?: Prisma.TransactionClient,
  ): Promise<RentalRecord> {
    const client = tx ?? this.prisma;

    await client.rentalExtension.update({
      where: { id: input.extensionId },
      data: {
        status: 'REJECTED',
        resolvedAt: new Date(),
      },
    });

    return this.bumpVersion(
      input.rentalId,
      input.scope,
      input.expectedVersion,
      { status: 'ACTIVE', updatedBy: input.updatedBy },
      tx,
    );
  }

  /**
   * BR-ALQ-013 / UC-ALQ-006b - falta grave de ampliacion: el cliente retiene
   * el vehiculo sin cumplir los 4 requisitos (aviso 12h, autorizacion, pago,
   * adenda firmada). Marca la extension como BREACH, retiene el 100% de la
   * garantia (RentalDepositAdjustment FULL_RETENTION) y marca al cliente
   * como "rojo" (Customer.status). El alquiler NO cambia de estado aqui:
   * RentalStatus no tiene hoy un estado terminal para "vehiculo retenido
   * sin autorizacion" (ver domain/rental-status.ts) y agregar uno es una
   * decision de modelado fuera del alcance de este ticket.
   */
  async reportExtensionBreach(
    input: ReportExtensionBreachInput,
    tx?: Prisma.TransactionClient,
  ): Promise<RentalRecord> {
    const client = tx ?? this.prisma;

    await client.rentalExtension.update({
      where: { id: input.extensionId },
      data: {
        status: 'BREACH',
        resolvedAt: new Date(),
      },
    });

    const deposit = await client.rentalDeposit.findUniqueOrThrow({
      where: { rentalId: input.rentalId },
    });

    await client.rentalDepositAdjustment.create({
      data: {
        depositId: deposit.id,
        type: 'FULL_RETENTION',
        amount: deposit.originalAmount,
        reason: input.legalEvaluationNote,
        authorizedBy: input.updatedBy,
      },
    });

    await client.rentalDeposit.update({
      where: { id: deposit.id },
      data: { status: 'RETAINED' },
    });

    // Decision de diseno nueva (no existia un modulo/campo real de Clientes
    // para esto): se reutiliza el campo Customer.status ("NORMAL" | "ROJO")
    // agregado en esta misma migracion, en vez de modelar una lista negra
    // separada sin fuente BDD/SDD de Clientes que lo respalde.
    await client.customer.update({
      where: { id: input.customerId },
      data: { status: 'ROJO' },
    });

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
      include: {
        customer: true,
        vehicle: true,
        parties: true,
        notaryEvaluation: true,
        contract: true,
        deposit: true,
      },
    });

    return toRecord(updated);
  }
}
