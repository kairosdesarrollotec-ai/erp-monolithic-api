import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import { AirportServiceRecord, AirportServiceTargetType } from '../../domain/airport-service';
import {
  AirportServiceRepositoryPort,
  CreateAirportServiceInput,
} from '../../application/ports/airport-service-repository.port';

@Injectable()
export class PrismaAirportServiceRepository implements AirportServiceRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findByTarget(
    targetType: AirportServiceTargetType,
    targetId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<AirportServiceRecord | null> {
    const client = tx ?? this.prisma;
    const row = await client.airportServiceRequest.findFirst({
      where: {
        targetType,
        targetId,
      },
      orderBy: { createdAt: 'desc' },
    });
    return row ? this.toRecord(row) : null;
  }

  async recordAirportService(
    input: CreateAirportServiceInput,
    tx?: Prisma.TransactionClient,
  ): Promise<AirportServiceRecord> {
    const client = tx ?? this.prisma;
    const existing = await client.airportServiceRequest.findFirst({
      where: {
        targetType: input.targetType,
        targetId: input.targetId,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existing) {
      const updated = await client.airportServiceRequest.update({
        where: { id: existing.id },
        data: {
          scheduledAt: input.scheduledAt,
          location: input.location,
          additionalAmount: new Prisma.Decimal(input.additionalAmount),
          notes: input.notes ?? null,
          registeredBy: input.registeredBy,
        },
      });
      return this.toRecord(updated);
    }

    const created = await client.airportServiceRequest.create({
      data: {
        organizationId: input.organizationId,
        operatingCompanyId: input.operatingCompanyId,
        branchId: input.branchId,
        targetType: input.targetType,
        targetId: input.targetId,
        scheduledAt: input.scheduledAt,
        location: input.location,
        additionalAmount: new Prisma.Decimal(input.additionalAmount),
        notes: input.notes ?? null,
        registeredBy: input.registeredBy,
      },
    });
    return this.toRecord(created);
  }

  private toRecord(row: {
    id: string;
    organizationId: string;
    operatingCompanyId: string;
    branchId: string;
    targetType: 'RESERVATION' | 'RENTAL';
    targetId: string;
    scheduledAt: Date;
    location: string;
    additionalAmount: Prisma.Decimal;
    notes: string | null;
    registeredBy: string;
    createdAt: Date;
    updatedAt: Date;
  }): AirportServiceRecord {
    return {
      id: row.id,
      organizationId: row.organizationId,
      operatingCompanyId: row.operatingCompanyId,
      branchId: row.branchId,
      targetType: row.targetType,
      targetId: row.targetId,
      scheduledAt: row.scheduledAt,
      location: row.location,
      additionalAmount: row.additionalAmount.toFixed(2),
      notes: row.notes,
      registeredBy: row.registeredBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
