import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import {
  RentalExtensionRecord,
  RequestExtensionInput,
  AuthorizeExtensionInput,
  RejectExtensionInput,
  ReportExtensionBreachInput,
} from '../../application/ports/rental-repository.port';
import { toRentalExtensionRecord } from './rental-persistence.mapper';

@Injectable()
export class PrismaRentalExtensionPersistence {
  constructor(private readonly prisma: PrismaService) {}

  async findPendingByRentalId(
    rentalId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<RentalExtensionRecord | null> {
    const client = tx ?? this.prisma;
    const row = await client.rentalExtension.findFirst({
      where: { rentalId, status: 'PENDING' },
      orderBy: { requestedAt: 'desc' },
    });
    return row ? toRentalExtensionRecord(row) : null;
  }

  async listByRentalId(
    rentalId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<RentalExtensionRecord[]> {
    const client = tx ?? this.prisma;
    const rows = await client.rentalExtension.findMany({
      where: { rentalId },
      orderBy: { requestedAt: 'desc' },
    });
    return rows.map(toRentalExtensionRecord);
  }

  async findRentalIdsWithBreach(rentalIds: readonly string[], tx?: Prisma.TransactionClient): Promise<Set<string>> {
    if (rentalIds.length === 0) return new Set();
    const client = tx ?? this.prisma;
    const rows = await client.rentalExtension.findMany({
      where: { rentalId: { in: [...rentalIds] }, status: 'BREACH' },
      select: { rentalId: true },
    });
    return new Set(rows.map((r) => r.rentalId));
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

  async createPending(
    input: RequestExtensionInput,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx ?? this.prisma;
    await client.rentalExtension.create({
      data: {
        rentalId: input.rentalId,
        requestedEndAt: input.requestedEndAt,
        status: 'PENDING',
      },
    });
  }

  async authorize(
    input: AuthorizeExtensionInput,
    tx?: Prisma.TransactionClient,
  ): Promise<{ requestedEndAt: Date }> {
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

    return { requestedEndAt: extension.requestedEndAt };
  }

  async reject(
    input: RejectExtensionInput,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx ?? this.prisma;
    await client.rentalExtension.update({
      where: { id: input.extensionId },
      data: {
        status: 'REJECTED',
        resolvedAt: new Date(),
      },
    });
  }

  /**
   * BR-ALQ-013 / UC-ALQ-006b - falta grave de ampliacion: el cliente retiene
   * el vehiculo sin cumplir los 4 requisitos (aviso 12h, autorizacion, pago,
   * adenda firmada). Marca la extension como BREACH, retiene el 100% de la
   * garantia (RentalDepositAdjustment FULL_RETENTION) y marca al cliente
   * como "rojo" (Customer.status).
   */
  async processBreach(
    input: ReportExtensionBreachInput,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx ?? this.prisma;

    await client.rentalExtension.update({
      where: { id: input.extensionId },
      data: {
        status: 'BREACH',
        resolvedAt: new Date(),
      },
    });

    // DEC-ALQ-COMPANY-DRIVER-004: con conductor de la empresa no hay garantia (sin fila): no hay nada que retener.
    const deposit = await client.rentalDeposit.findUnique({
      where: { rentalId: input.rentalId },
    });

    if (deposit) {
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
    }

    // Reutiliza el campo Customer.status ("NORMAL" | "AMBAR" | "ROJO"; ROJO es el estado terminal del semáforo, BR-DEV-008)
    await client.customer.update({
      where: { id: input.customerId },
      data: { status: 'ROJO', statusReason: 'Falta grave: ampliación no regularizada (BR-ALQ-013).', statusChangedAt: new Date() },
    });
  }
}
