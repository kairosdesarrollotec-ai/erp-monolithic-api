import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import {
  ReservationRepositoryPort,
  ReservationRecord,
  ReservationScope,
  CreateReservationInput,
  ListReservationsFilter,
  CancelReservationInput,
  CustomerRecord,
  VehicleRecord,
  InquiryRecord,
} from '../../application/ports/reservation-repository.port';
import {
  ReservationVersionConflictError,
  VehicleNotAvailableError,
} from '../../domain/reservation-errors';

/**
 * Nota de tipado (PROP-003/NOTA-PROP-003, docs/decision-log.md): el
 * cliente Prisma generado en los shells de Claude Code queda
 * desactualizado frente al schema real cada vez que este cambia, porque
 * `prisma generate` no tiene salida de red hacia binaries.prisma.sh en
 * esos entornos - solo funciona en la Terminal real de macOS del
 * usuario. Los `as unknown as` de este archivo describen la forma REAL
 * que produce el schema actual, no un intento de ocultar una
 * incompatibilidad.
 */
type ReservationRow = {
  id: string;
  organizationId: string;
  operatingCompanyId: string;
  branchId: string;
  inquiryId: string;
  customerId: string;
  vehicleId: string;
  status: ReservationRecord['status'];
  channelMode: ReservationRecord['channelMode'];
  startAt: Date;
  endAt: Date;
  requiredPaymentAmount: { toString(): string };
  currency: string;
  paymentPolicyVersion: number;
  paymentValidatedAt: Date | null;
  documentsCompletedAt: Date | null;
  confirmedAt: Date | null;
  createdAt: Date;
  createdBy: string;
  version: number;
  customer: { fullName: string };
  vehicle: { plate: string; brand: string; model: string };
};

function toRecord(row: ReservationRow): ReservationRecord {
  return {
    id: row.id,
    organizationId: row.organizationId,
    operatingCompanyId: row.operatingCompanyId,
    branchId: row.branchId,
    inquiryId: row.inquiryId,
    customerId: row.customerId,
    customerName: row.customer.fullName,
    vehicleId: row.vehicleId,
    vehiclePlate: row.vehicle.plate,
    vehicleLabel: `${row.vehicle.brand} ${row.vehicle.model} - ${row.vehicle.plate}`,
    status: row.status,
    channelMode: row.channelMode,
    startAt: row.startAt,
    endAt: row.endAt,
    requiredPaymentAmount: row.requiredPaymentAmount.toString(),
    currency: row.currency,
    paymentPolicyVersion: row.paymentPolicyVersion,
    paymentValidatedAt: row.paymentValidatedAt,
    documentsCompletedAt: row.documentsCompletedAt,
    confirmedAt: row.confirmedAt,
    createdAt: row.createdAt,
    createdBy: row.createdBy,
    version: row.version,
  };
}

/** Hallazgo critico PR#6 ("IDOR"): where de scope completo, reusado en cada lectura/mutacion puntual. */
function scopeWhere(id: string, scope: ReservationScope) {
  return {
    id,
    organizationId: scope.organizationId,
    operatingCompanyId: scope.operatingCompanyId,
    branchId: scope.branchId,
  };
}

@Injectable()
export class PrismaReservationRepository implements ReservationRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    input: CreateReservationInput,
    tx?: Prisma.TransactionClient,
  ): Promise<ReservationRecord> {
    const client = (tx ?? this.prisma) as unknown as { reservation: any };
    const created = await client.reservation.create({
      data: {
        organizationId: input.organizationId,
        operatingCompanyId: input.operatingCompanyId,
        branchId: input.branchId,
        inquiryId: input.inquiryId,
        customerId: input.customerId,
        vehicleId: input.vehicleId,
        channelMode: input.channelMode,
        startAt: input.startAt,
        endAt: input.endAt,
        requiredPaymentAmount: input.requiredPaymentAmount,
        currency: input.currency,
        paymentPolicyVersion: input.paymentPolicyVersion,
        createdBy: input.createdBy,
      },
      include: { customer: true, vehicle: true },
    });
    return toRecord(created as unknown as ReservationRow);
  }

  async findById(
    id: string,
    scope: ReservationScope,
    tx?: Prisma.TransactionClient,
  ): Promise<ReservationRecord | null> {
    const client = (tx ?? this.prisma) as unknown as { reservation: any };
    const row = await client.reservation.findFirst({
      where: scopeWhere(id, scope),
      include: { customer: true, vehicle: true },
    });
    return row ? toRecord(row as unknown as ReservationRow) : null;
  }

  async list(filter: ListReservationsFilter): Promise<ReservationRecord[]> {
    const client = this.prisma as unknown as { reservation: any };
    const rows = await client.reservation.findMany({
      where: {
        organizationId: filter.organizationId,
        operatingCompanyId: filter.operatingCompanyId,
        branchId: filter.branchId,
        status: filter.status,
      },
      include: { customer: true, vehicle: true },
      // Hallazgo medio "listado sin paginacion": cursor estable
      // (createdAt DESC, id DESC como desempate) + limite maximo, en vez
      // de traer la tabla completa.
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: filter.limit,
      ...(filter.cursor
        ? {
            cursor: { id: filter.cursor.id },
            skip: 1,
          }
        : {}),
    });
    return (rows as unknown as ReservationRow[]).map(toRecord);
  }

  async findCustomerById(id: string): Promise<CustomerRecord | null> {
    const client = this.prisma as unknown as { customer: any };
    const row = await client.customer.findUnique({ where: { id }, select: { id: true, organizationId: true } });
    return row ?? null;
  }

  async findVehicleById(id: string): Promise<VehicleRecord | null> {
    const client = this.prisma as unknown as { vehicle: any };
    const row = await client.vehicle.findUnique({ where: { id }, select: { id: true, organizationId: true } });
    return row ?? null;
  }

  async findInquiryById(id: string): Promise<InquiryRecord | null> {
    const client = this.prisma as unknown as { inquiry: any };
    const row = await client.inquiry.findUnique({ where: { id }, select: { id: true, organizationId: true } });
    return row ?? null;
  }

  async registerPayment(
    id: string,
    scope: ReservationScope,
    expectedVersion: number,
    tx?: Prisma.TransactionClient,
  ): Promise<ReservationRecord> {
    return this.bumpVersion(id, scope, expectedVersion, { paymentValidatedAt: new Date() }, tx);
  }

  async registerDocuments(
    id: string,
    scope: ReservationScope,
    expectedVersion: number,
    tx?: Prisma.TransactionClient,
  ): Promise<ReservationRecord> {
    return this.bumpVersion(id, scope, expectedVersion, { documentsCompletedAt: new Date() }, tx);
  }

  private async bumpVersion(
    id: string,
    scope: ReservationScope,
    expectedVersion: number,
    data: Record<string, unknown>,
    tx?: Prisma.TransactionClient,
  ): Promise<ReservationRecord> {
    const client = (tx ?? this.prisma) as unknown as { reservation: any };
    const result = await client.reservation.updateMany({
      where: { ...scopeWhere(id, scope), version: expectedVersion },
      data: { ...data, version: { increment: 1 } },
    });
    if (result.count === 0) {
      throw new ReservationVersionConflictError();
    }
    const updated = await client.reservation.findFirstOrThrow({
      where: scopeWhere(id, scope),
      include: { customer: true, vehicle: true },
    });
    return toRecord(updated as unknown as ReservationRow);
  }

  /**
   * TDD-RES-001.md seccion 10.1 - transaccion atomica unica: re-verifica
   * ambos requisitos dentro de la propia transaccion (no confia solo en
   * la lectura previa del handler, por seguridad frente a condiciones de
   * carrera), y solicita el vehicle_commitment consolidado en el mismo
   * paso.
   *
   * Hallazgo critico PR#6 ("cambio de estado y auditoria no son
   * atomicos"): `tx` ahora es OBLIGATORIO (lo abre el handler via
   * TransactionManagerPort.run con isolationLevel Serializable) en vez
   * de que este metodo abra su propia transaccion - asi la escritura de
   * auditoria del handler puede ejecutarse dentro del mismo `tx`,
   * despues de este metodo, sin una segunda transaccion separada.
   */
  async confirm(
    id: string,
    scope: ReservationScope,
    expectedVersion: number,
    tx: Prisma.TransactionClient,
  ): Promise<ReservationRecord> {
    const client = tx as unknown as { reservation: any; vehicleCommitment: any };
    const reservation = await client.reservation.findFirst({ where: scopeWhere(id, scope) });
    if (!reservation || reservation.version !== expectedVersion) {
      throw new ReservationVersionConflictError();
    }
    if (!reservation.paymentValidatedAt || !reservation.documentsCompletedAt) {
      // El handler ya valida esto antes de llegar aqui; esta es la
      // re-verificacion de seguridad dentro de la transaccion.
      throw new ReservationVersionConflictError();
    }

    const overlapping = await client.vehicleCommitment.findFirst({
      where: {
        vehicleId: reservation.vehicleId,
        status: { in: ['ACTIVE', 'CONSOLIDATED'] },
        startsAt: { lt: reservation.endAt },
        endsAt: { gt: reservation.startAt },
      },
    });
    if (overlapping) {
      throw new VehicleNotAvailableError();
    }

    await client.vehicleCommitment.create({
      data: {
        organizationId: scope.organizationId,
        vehicleId: reservation.vehicleId,
        sourceType: 'RESERVATION',
        sourceId: reservation.id,
        status: 'CONSOLIDATED',
        startsAt: reservation.startAt,
        endsAt: reservation.endAt,
      },
    });

    const updated = await client.reservation.update({
      where: { id },
      data: { status: 'CONFIRMED', confirmedAt: new Date(), version: { increment: 1 } },
      include: { customer: true, vehicle: true },
    });

    return toRecord(updated as unknown as ReservationRow);
  }

  /** Hallazgo critico PR#6: `tx` obligatorio, mismo motivo que `confirm` (ver comentario arriba). */
  async cancel(input: CancelReservationInput, tx: Prisma.TransactionClient): Promise<ReservationRecord> {
    const client = tx as unknown as { reservation: any; vehicleCommitment: any };
    const reservation = await client.reservation.findFirst({ where: scopeWhere(input.id, input) });
    if (!reservation || reservation.version !== input.expectedVersion) {
      throw new ReservationVersionConflictError();
    }

    if (reservation.status === 'CONFIRMED') {
      await client.vehicleCommitment.updateMany({
        where: { sourceType: 'RESERVATION', sourceId: reservation.id, status: { in: ['ACTIVE', 'CONSOLIDATED'] } },
        data: { status: 'RELEASED' },
      });
    }

    const updated = await client.reservation.update({
      where: { id: input.id },
      data: { status: 'CANCELLED', version: { increment: 1 } },
      include: { customer: true, vehicle: true },
    });

    return toRecord(updated as unknown as ReservationRow);
  }
}
