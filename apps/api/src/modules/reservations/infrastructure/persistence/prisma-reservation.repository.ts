import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import {
  ReservationRepositoryPort,
  ReservationRecord,
  CreateReservationInput,
  ListReservationsFilter,
  CancelReservationInput,
} from '../../application/ports/reservation-repository.port';
import {
  ReservationVersionConflictError,
  VehicleNotAvailableError,
} from '../../domain/reservation-errors';

type ReservationWithRelations = Prisma.ReservationGetPayload<{
  include: { customer: true; vehicle: true };
}>;

function toRecord(row: ReservationWithRelations): ReservationRecord {
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
    status: row.status as ReservationRecord['status'],
    channelMode: row.channelMode as ReservationRecord['channelMode'],
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

@Injectable()
export class PrismaReservationRepository implements ReservationRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateReservationInput): Promise<ReservationRecord> {
    const created = await this.prisma.reservation.create({
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
    return toRecord(created);
  }

  async findById(id: string, organizationId: string): Promise<ReservationRecord | null> {
    const row = await this.prisma.reservation.findFirst({
      where: { id, organizationId },
      include: { customer: true, vehicle: true },
    });
    return row ? toRecord(row) : null;
  }

  async list(filter: ListReservationsFilter): Promise<ReservationRecord[]> {
    const rows = await this.prisma.reservation.findMany({
      where: {
        organizationId: filter.organizationId,
        operatingCompanyId: filter.operatingCompanyId,
        status: filter.status,
      },
      include: { customer: true, vehicle: true },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toRecord);
  }

  async registerPayment(
    id: string,
    organizationId: string,
    expectedVersion: number,
  ): Promise<ReservationRecord> {
    return this.bumpVersion(id, organizationId, expectedVersion, { paymentValidatedAt: new Date() });
  }

  async registerDocuments(
    id: string,
    organizationId: string,
    expectedVersion: number,
  ): Promise<ReservationRecord> {
    return this.bumpVersion(id, organizationId, expectedVersion, { documentsCompletedAt: new Date() });
  }

  private async bumpVersion(
    id: string,
    organizationId: string,
    expectedVersion: number,
    data: Prisma.ReservationUpdateInput,
  ): Promise<ReservationRecord> {
    const result = await this.prisma.reservation.updateMany({
      where: { id, organizationId, version: expectedVersion },
      data: { ...data, version: { increment: 1 } },
    });
    if (result.count === 0) {
      throw new ReservationVersionConflictError();
    }
    const updated = await this.prisma.reservation.findFirstOrThrow({
      where: { id, organizationId },
      include: { customer: true, vehicle: true },
    });
    return toRecord(updated);
  }

  /**
   * TDD-RES-001.md seccion 10.1 - transaccion atomica unica: re-verifica
   * ambos requisitos dentro de la propia transaccion (no confia solo en
   * la lectura previa del handler, por seguridad frente a condiciones de
   * carrera), y solicita el vehicle_commitment consolidado en el mismo
   * paso. Usa nivel Serializable + verificacion manual de solapamiento
   * (no exclusion GiST declarativa - Prisma no la expone; ver nota de
   * alcance en PROP-005/docs/decision-log.md) para aproximar DR-RES-001.
   */
  async confirm(id: string, organizationId: string, expectedVersion: number): Promise<ReservationRecord> {
    const confirmed = await this.prisma.$transaction(
      async (tx) => {
        const reservation = await tx.reservation.findFirst({ where: { id, organizationId } });
        if (!reservation || reservation.version !== expectedVersion) {
          throw new ReservationVersionConflictError();
        }
        if (!reservation.paymentValidatedAt || !reservation.documentsCompletedAt) {
          // El handler ya valida esto antes de llegar aqui; esta es la
          // re-verificacion de seguridad dentro de la transaccion.
          throw new ReservationVersionConflictError();
        }

        const overlapping = await tx.vehicleCommitment.findFirst({
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

        await tx.vehicleCommitment.create({
          data: {
            organizationId,
            vehicleId: reservation.vehicleId,
            sourceType: 'RESERVATION',
            sourceId: reservation.id,
            status: 'CONSOLIDATED',
            startsAt: reservation.startAt,
            endsAt: reservation.endAt,
          },
        });

        return tx.reservation.update({
          where: { id },
          data: { status: 'CONFIRMED', confirmedAt: new Date(), version: { increment: 1 } },
          include: { customer: true, vehicle: true },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return toRecord(confirmed);
  }

  async cancel(input: CancelReservationInput): Promise<ReservationRecord> {
    const cancelled = await this.prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.findFirst({
        where: { id: input.id, organizationId: input.organizationId },
      });
      if (!reservation || reservation.version !== input.expectedVersion) {
        throw new ReservationVersionConflictError();
      }

      if (reservation.status === 'CONFIRMED') {
        await tx.vehicleCommitment.updateMany({
          where: { sourceType: 'RESERVATION', sourceId: reservation.id, status: { in: ['ACTIVE', 'CONSOLIDATED'] } },
          data: { status: 'RELEASED' },
        });
      }

      return tx.reservation.update({
        where: { id: input.id },
        data: { status: 'CANCELLED', version: { increment: 1 } },
        include: { customer: true, vehicle: true },
      });
    });

    return toRecord(cancelled);
  }
}
