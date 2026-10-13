import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import { findFirstVehicleConflict } from '../../../../common/persistence/vehicle-overlap';
import { ReservationRecord, ReservationScope } from '../../application/ports/reservation-repository.port';
import {
  AcceptSaleInput,
  FlagSaleInput,
  RejectSaleInput,
  ReservationSaleResolutionRepositoryPort,
  SaleAlternativeVehicleRecord,
} from '../../application/ports/reservation-sale-resolution-repository.port';
import {
  ReservationSaleResolutionRecord,
  SALE_RESOLUTION_REASON,
  SaleRefundStatus,
  SaleResolutionAlreadyOpenError,
} from '../../domain/reservation-sale-resolution';
import { ReservationVersionConflictError } from '../../domain/reservation-errors';
import { toReservationRecord, RESERVATION_INCLUDE } from './reservation-record.mapper';

function scopeWhere(id: string, scope: ReservationScope) {
  return {
    id,
    organizationId: scope.organizationId,
    operatingCompanyId: scope.operatingCompanyId,
    branchId: scope.branchId,
  };
}

type ResolutionRow = Prisma.ReservationResolutionGetPayload<Record<string, never>>;

/**
 * UC-RES-004 - persistencia de la venta de vehiculo reservado. Mismo patron
 * que PrismaReservationRepository.cancel: `updateMany` atomico con scope +
 * version + estado en el where; si `count !== 1` otra operacion se adelanto
 * (412 RESERVATION_VERSION_CONFLICT). Los side effects sobre
 * `vehicle_commitments` corren en el mismo `tx`.
 */
@Injectable()
export class PrismaReservationSaleResolutionRepository implements ReservationSaleResolutionRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findVehicleById(id: string, tx?: Prisma.TransactionClient): Promise<SaleAlternativeVehicleRecord | null> {
    const client = tx ?? this.prisma;
    return client.vehicle.findUnique({
      where: { id },
      select: { id: true, organizationId: true, operatingCompanyId: true, branchId: true, status: true, plate: true },
    });
  }

  async findVehicleConflict(
    vehicleId: string,
    from: Date,
    to: Date,
    excludeReservationId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<{ from: Date; to: Date } | null> {
    const conflict = await findFirstVehicleConflict(tx ?? this.prisma, vehicleId, from, to, { excludeReservationId });
    return conflict ? { from: conflict.from, to: conflict.to } : null;
  }

  async findLatestByReservationId(
    reservationId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<ReservationSaleResolutionRecord | null> {
    const client = tx ?? this.prisma;
    const row = await client.reservationResolution.findFirst({
      where: { reservationId },
      orderBy: [{ flaggedAt: 'desc' }, { id: 'desc' }],
    });
    return row ? this.toRecord(row, client) : null;
  }

  async flagSale(input: FlagSaleInput, tx: Prisma.TransactionClient): Promise<ReservationRecord> {
    const reservation = await tx.reservation.findFirst({ where: scopeWhere(input.id, input) });
    if (!reservation) throw new ReservationVersionConflictError();

    // El commitment (vehicle_commitments) se mantiene hasta resolve-sale (UC-RES-004 / TDD 11.1).
    const result = await tx.reservation.updateMany({
      where: { ...scopeWhere(input.id, input), version: input.expectedVersion, status: 'CONFIRMED' },
      data: { status: 'PENDING_SALE_RESOLUTION', version: { increment: 1 } },
    });
    if (result.count !== 1) throw new ReservationVersionConflictError();

    try {
      await tx.reservationResolution.create({
        data: {
          organizationId: input.organizationId,
          reservationId: input.id,
          reason: SALE_RESOLUTION_REASON,
          originalVehicleId: reservation.vehicleId,
          offeredVehicleId: input.offeredVehicleId ?? null,
          offerNote: input.note ?? null,
          flaggedBy: input.flaggedBy,
        },
      });
    } catch (error) {
      // Indice unico parcial reservation_resolutions_one_open_idx.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new SaleResolutionAlreadyOpenError();
      }
      throw error;
    }
    return this.reload(input.id, input, tx);
  }

  async rejectSale(input: RejectSaleInput, tx: Prisma.TransactionClient): Promise<ReservationRecord> {
    const open = await this.requireOpenResolution(input.id, tx);

    const result = await tx.reservation.updateMany({
      where: {
        ...scopeWhere(input.id, input),
        version: input.expectedVersion,
        status: 'PENDING_SALE_RESOLUTION',
      },
      data: { status: 'CANCELLED', version: { increment: 1 } },
    });
    if (result.count !== 1) throw new ReservationVersionConflictError();

    await this.releaseCommitment(input.id, tx);
    const refundStatus: SaleRefundStatus = 'PENDING_TRANSFER';
    await this.closeResolution(open.id, tx, {
      customerDecision: 'REJECTED',
      refundStatus,
      resolutionNote: input.note ?? null,
      resolvedBy: input.resolvedBy,
    });
    return this.reload(input.id, input, tx);
  }

  async acceptAlternative(input: AcceptSaleInput, tx: Prisma.TransactionClient): Promise<ReservationRecord> {
    const open = await this.requireOpenResolution(input.id, tx);

    // Vuelve a DRAFT sobre el vehiculo alternativo; el pago validado se conserva y los
    // documentos/contrato se limpian (hay que reenviar requisitos, BDD 10.6). Sin commitment
    // hasta que RES-04 (confirm) cree uno nuevo, como en cualquier reserva en DRAFT.
    const result = await tx.reservation.updateMany({
      where: {
        ...scopeWhere(input.id, input),
        version: input.expectedVersion,
        status: 'PENDING_SALE_RESOLUTION',
      },
      data: {
        status: 'DRAFT',
        vehicleId: input.alternativeVehicleId,
        documentsCompletedAt: null,
        confirmedAt: null,
        version: { increment: 1 },
      },
    });
    if (result.count !== 1) throw new ReservationVersionConflictError();

    await this.releaseCommitment(input.id, tx);
    await this.closeResolution(open.id, tx, {
      customerDecision: 'ACCEPTED',
      alternativeVehicleId: input.alternativeVehicleId,
      resolutionNote: input.note ?? null,
      resolvedBy: input.resolvedBy,
    });
    return this.reload(input.id, input, tx);
  }

  private async requireOpenResolution(reservationId: string, tx: Prisma.TransactionClient): Promise<ResolutionRow> {
    const open = await tx.reservationResolution.findFirst({ where: { reservationId, customerDecision: null } });
    if (!open) throw new ReservationVersionConflictError();
    return open;
  }

  private async releaseCommitment(reservationId: string, tx: Prisma.TransactionClient): Promise<void> {
    await tx.vehicleCommitment.updateMany({
      where: { sourceType: 'RESERVATION', sourceId: reservationId, status: { in: ['ACTIVE', 'CONSOLIDATED'] } },
      data: { status: 'RELEASED' },
    });
  }

  private async closeResolution(
    id: string,
    tx: Prisma.TransactionClient,
    data: Prisma.ReservationResolutionUncheckedUpdateManyInput,
  ): Promise<void> {
    const closed = await tx.reservationResolution.updateMany({
      where: { id, customerDecision: null },
      data: { ...data, resolvedAt: new Date() },
    });
    if (closed.count !== 1) throw new ReservationVersionConflictError();
  }

  private async reload(id: string, scope: ReservationScope, tx: Prisma.TransactionClient): Promise<ReservationRecord> {
    const updated = await tx.reservation.findFirstOrThrow({ where: scopeWhere(id, scope), include: RESERVATION_INCLUDE });
    return toReservationRecord(updated);
  }

  private async toRecord(row: ResolutionRow, client: Prisma.TransactionClient | PrismaService): Promise<ReservationSaleResolutionRecord> {
    const offered = row.offeredVehicleId
      ? await client.vehicle.findUnique({
          where: { id: row.offeredVehicleId },
          select: { id: true, plate: true, brand: true, model: true },
        })
      : null;
    const decision = row.customerDecision;
    return {
      id: row.id,
      reservationId: row.reservationId,
      reason: row.reason,
      status: decision === 'ACCEPTED' ? 'ACCEPTED' : decision === 'REJECTED' ? 'REJECTED' : 'PENDING',
      originalVehicleId: row.originalVehicleId,
      offeredVehicle: offered
        ? { id: offered.id, plate: offered.plate, label: `${offered.brand} ${offered.model} - ${offered.plate}` }
        : null,
      offerNote: row.offerNote,
      flaggedBy: row.flaggedBy,
      flaggedAt: row.flaggedAt,
      alternativeVehicleId: row.alternativeVehicleId,
      refundStatus: row.refundStatus === 'PENDING_TRANSFER' ? 'PENDING_TRANSFER' : null,
      resolutionNote: row.resolutionNote,
      resolvedBy: row.resolvedBy,
      resolvedAt: row.resolvedAt,
    };
  }
}
