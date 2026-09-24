import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import {
  InquiryRepositoryPort,
  InquiryRecord,
  InquirySummaryRecord,
  InquiryScope,
  CreateInquiryInput,
  ListInquiriesFilter,
  QuoteInquiryInput,
  CloseInquiryInput,
  ConvertToReservationInput,
  CustomerRecord,
} from '../../application/ports/inquiry-repository.port';
import { InquiryStatus } from '../../domain/inquiry-status';
import { InquiryVersionConflictError } from '../../domain/inquiry-errors';

/**
 * Hallazgo MEDIO de revision PR#6/PR#7 ("casts `as unknown as` ocultan la
 * verificacion real del cliente Prisma"): los tipos se derivan del
 * cliente generado (`Prisma.InquiryGetPayload`), sin casts. Compila solo
 * contra un `prisma generate` del schema actual.
 */
const DETAIL_INCLUDE = {
  interactions: { orderBy: { occurredAt: 'asc' } },
  quotations: { orderBy: { createdAt: 'desc' } },
} satisfies Prisma.InquiryInclude;

type InquiryRow = Prisma.InquiryGetPayload<Record<string, never>>;
type InquiryDetailRow = Prisma.InquiryGetPayload<{ include: typeof DETAIL_INCLUDE }>;

function toSummary(row: InquiryRow): InquirySummaryRecord {
  return {
    id: row.id,
    organizationId: row.organizationId,
    operatingCompanyId: row.operatingCompanyId,
    branchId: row.branchId,
    customerId: row.customerId,
    channel: row.channel,
    touristUse: row.touristUse,
    prospectName: row.prospectName,
    prospectDocumentType: row.prospectDocumentType,
    prospectDocumentNumber: row.prospectDocumentNumber,
    nationality: row.nationality,
    destination: row.destination,
    estimatedDays: row.estimatedDays,
    travelStartDate: row.travelStartDate,
    partySize: row.partySize,
    countryEntryDate: row.countryEntryDate,
    dataOrigin: row.dataOrigin,
    status: row.status,
    closedReason: row.closedReason,
    createdAt: row.createdAt,
    createdBy: row.createdBy,
    version: row.version,
  };
}

function toRecord(row: InquiryDetailRow): InquiryRecord {
  return {
    ...toSummary(row),
    interactions: row.interactions.map((interaction) => ({
      id: interaction.id,
      channel: interaction.channel,
      occurredAt: interaction.occurredAt,
      outcome: interaction.outcome,
      note: interaction.note,
    })),
    quotations: row.quotations.map((quotation) => ({
      id: quotation.id,
      vehicleId: quotation.vehicleId,
      rateCardVersionId: quotation.rateCardVersionId,
      destination: quotation.destination,
      estimatedDays: quotation.estimatedDays,
      amount: quotation.amount.toFixed(2),
      currency: quotation.currency,
      validUntil: quotation.validUntil,
      createdAt: quotation.createdAt,
    })),
  };
}

function scopeWhere(id: string, scope: InquiryScope): Prisma.InquiryWhereInput {
  return {
    id,
    organizationId: scope.organizationId,
    operatingCompanyId: scope.operatingCompanyId,
    branchId: scope.branchId,
  };
}

@Injectable()
export class PrismaInquiryRepository implements InquiryRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateInquiryInput): Promise<InquiryRecord> {
    const created = await this.prisma.inquiry.create({
      data: {
        organizationId: input.organizationId,
        operatingCompanyId: input.operatingCompanyId,
        branchId: input.branchId,
        customerId: input.customerId,
        channel: input.channel,
        touristUse: input.touristUse,
        prospectName: input.prospectName,
        prospectDocumentType: input.prospectDocumentType,
        prospectDocumentNumber: input.prospectDocumentNumber,
        nationality: input.nationality,
        destination: input.destination,
        estimatedDays: input.estimatedDays,
        travelStartDate: input.travelStartDate,
        partySize: input.partySize,
        countryEntryDate: input.countryEntryDate,
        dataOrigin: 'CON02',
        createdBy: input.createdBy,
      },
      include: DETAIL_INCLUDE,
    });
    return toRecord(created);
  }

  async findById(id: string, scope: InquiryScope, tx?: Prisma.TransactionClient): Promise<InquiryRecord | null> {
    const client = tx ?? this.prisma;
    const row = await client.inquiry.findFirst({ where: scopeWhere(id, scope), include: DETAIL_INCLUDE });
    return row ? toRecord(row) : null;
  }

  /**
   * CON-01. Hallazgo MEDIO de revalidacion PR#7:
   * - proyeccion de resumen (sin `include` de historial);
   * - keyset REAL sobre (createdAt DESC, id DESC): la pagina siguiente son
   *   las filas con createdAt anterior al cursor, o el mismo createdAt con
   *   id menor. Antes `cursorCreatedAt` se ignoraba y solo se usaba el id.
   *   Respaldado por el indice (org, company, branch, created_at DESC,
   *   id DESC).
   */
  async list(filter: ListInquiriesFilter): Promise<InquirySummaryRecord[]> {
    const and: Prisma.InquiryWhereInput[] = [];
    if (filter.createdFrom || filter.createdTo) {
      and.push({ createdAt: { gte: filter.createdFrom, lte: filter.createdTo } });
    }
    if (filter.cursor) {
      and.push({
        OR: [
          { createdAt: { lt: filter.cursor.createdAt } },
          { createdAt: filter.cursor.createdAt, id: { lt: filter.cursor.id } },
        ],
      });
    }
    const rows = await this.prisma.inquiry.findMany({
      where: {
        organizationId: filter.organizationId,
        operatingCompanyId: filter.operatingCompanyId,
        branchId: filter.branchId,
        customerId: filter.customerId,
        channel: filter.channel,
        status: filter.status,
        AND: and,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: filter.limit,
    });
    return rows.map(toSummary);
  }

  async findCustomerById(id: string): Promise<CustomerRecord | null> {
    return this.prisma.customer.findUnique({
      where: { id },
      select: { id: true, organizationId: true, operatingCompanyId: true },
    });
  }

  /**
   * Crea el snapshot `Quotation` y transiciona a COTIZADA en una unica
   * transaccion, con re-verificacion de version y estado de origen en el
   * propio `WHERE`. `operatingCompanyId` de la cotizacion es el del scope
   * autorizado: las FKs compuestas (inquiry y vehicle) garantizan en la
   * base que consulta, vehiculo y cotizacion son de la misma empresa.
   */
  async quote(input: QuoteInquiryInput, fromStatuses: InquiryStatus[]): Promise<InquiryRecord> {
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.inquiry.updateMany({
        where: { ...scopeWhere(input.id, input), version: input.expectedVersion, status: { in: fromStatuses } },
        data: { status: 'COTIZADA', version: { increment: 1 } },
      });
      if (result.count === 0) {
        throw new InquiryVersionConflictError();
      }

      await tx.quotation.create({
        data: {
          inquiryId: input.id,
          operatingCompanyId: input.operatingCompanyId,
          vehicleId: input.vehicleId,
          rateCardVersionId: input.rateCardVersionId,
          destination: input.destination,
          estimatedDays: input.estimatedDays,
          amount: new Prisma.Decimal(input.amount),
          currency: input.currency,
          validUntil: input.validUntil,
        },
      });

      const updated = await tx.inquiry.findFirstOrThrow({
        where: scopeWhere(input.id, input),
        include: DETAIL_INCLUDE,
      });
      return toRecord(updated);
    });
  }

  async close(
    input: CloseInquiryInput,
    fromStatuses: InquiryStatus[],
    tx?: Prisma.TransactionClient,
  ): Promise<InquiryRecord> {
    const client = tx ?? this.prisma;
    const result = await client.inquiry.updateMany({
      where: { ...scopeWhere(input.id, input), version: input.expectedVersion, status: { in: fromStatuses } },
      data: { status: 'CERRADA_SIN_CONVERSION', closedReason: input.reason, version: { increment: 1 } },
    });
    if (result.count === 0) {
      throw new InquiryVersionConflictError();
    }
    const updated = await client.inquiry.findFirstOrThrow({
      where: scopeWhere(input.id, input),
      include: DETAIL_INCLUDE,
    });
    return toRecord(updated);
  }

  async convertToReservation(
    input: ConvertToReservationInput,
    fromStatuses: InquiryStatus[],
    tx: Prisma.TransactionClient,
  ): Promise<InquiryRecord> {
    const result = await tx.inquiry.updateMany({
      where: { ...scopeWhere(input.id, input), version: input.expectedVersion, status: { in: fromStatuses } },
      data: { status: 'CONVERTIDA', version: { increment: 1 } },
    });
    if (result.count === 0) {
      throw new InquiryVersionConflictError();
    }
    const updated = await tx.inquiry.findFirstOrThrow({
      where: scopeWhere(input.id, input),
      include: DETAIL_INCLUDE,
    });
    return toRecord(updated);
  }
}
