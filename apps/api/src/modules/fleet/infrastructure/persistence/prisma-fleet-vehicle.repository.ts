import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import {
  CreateVehicleInput,
  FleetVehicleRepositoryPort,
  ListVehiclesFilters,
  UpdateVehicleInput,
} from '../../application/ports/fleet-vehicle-repository.port';
import { FleetVehicle, VehicleStatus } from '../../domain/vehicle';
import { findVehicleConflicts } from '../../../../common/persistence/vehicle-overlap';

function toDomain(row: {
  id: string;
  organizationId: string;
  operatingCompanyId: string;
  branchId: string | null;
  plate: string;
  brand: string;
  model: string;
  year: number | null;
  color: string | null;
  category: string | null;
  status: string;
  dailyRate: Prisma.Decimal | null;
  depositMinimum: Prisma.Decimal | null;
  passengerCapacity: number | null;
  fuelPrice: Prisma.Decimal | null;
  photoUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}): FleetVehicle {
  return {
    id: row.id,
    organizationId: row.organizationId,
    operatingCompanyId: row.operatingCompanyId,
    branchId: row.branchId,
    plate: row.plate,
    brand: row.brand,
    model: row.model,
    year: row.year,
    color: row.color,
    category: row.category,
    status: row.status as VehicleStatus,
    dailyRate: row.dailyRate !== null ? Number(row.dailyRate) : null,
    depositMinimum: row.depositMinimum !== null ? Number(row.depositMinimum) : null,
    passengerCapacity: row.passengerCapacity,
    fuelPrice: row.fuelPrice !== null ? Number(row.fuelPrice) : null,
    photoUrl: row.photoUrl,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

@Injectable()
export class PrismaFleetVehicleRepository extends FleetVehicleRepositoryPort {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async create(input: CreateVehicleInput): Promise<FleetVehicle> {
    const row = await this.prisma.vehicle.create({
      data: {
        organizationId: input.organizationId,
        operatingCompanyId: input.operatingCompanyId,
        branchId: input.branchId ?? undefined,
        plate: input.plate,
        brand: input.brand,
        model: input.model,
        year: input.year ?? undefined,
        color: input.color ?? undefined,
        category: input.category ?? undefined,
        status: input.status ?? 'AVAILABLE',
        dailyRate: input.dailyRate !== undefined && input.dailyRate !== null ? new Prisma.Decimal(input.dailyRate) : undefined,
        depositMinimum:
          input.depositMinimum !== undefined && input.depositMinimum !== null
            ? new Prisma.Decimal(input.depositMinimum)
            : undefined,
        passengerCapacity: input.passengerCapacity,
        fuelPrice:
          input.fuelPrice !== undefined && input.fuelPrice !== null ? new Prisma.Decimal(input.fuelPrice) : undefined,
        photoUrl: input.photoUrl ?? undefined,
      },
    });

    return toDomain(row);
  }

  async findById(
    id: string,
    scope: { organizationId: string; operatingCompanyId: string },
  ): Promise<FleetVehicle | null> {
    const row = await this.prisma.vehicle.findFirst({
      where: {
        id,
        organizationId: scope.organizationId,
        operatingCompanyId: scope.operatingCompanyId,
      },
    });

    return row ? toDomain(row) : null;
  }

  async findByPlate(plate: string): Promise<FleetVehicle | null> {
    const row = await this.prisma.vehicle.findUnique({
      where: { plate },
    });

    return row ? toDomain(row) : null;
  }

  async findConflicts(vehicleIds: readonly string[], from: Date, to: Date) {
    return findVehicleConflicts(this.prisma, vehicleIds, from, to);
  }

  async list(
    filters: ListVehiclesFilters,
  ): Promise<{ items: FleetVehicle[]; total: number }> {
    const where: Prisma.VehicleWhereInput = {
      organizationId: filters.organizationId,
      operatingCompanyId: filters.operatingCompanyId,
    };

    if (filters.branchId) {
      where.branchId = filters.branchId;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.search) {
      where.OR = [
        { plate: { contains: filters.search, mode: 'insensitive' } },
        { brand: { contains: filters.search, mode: 'insensitive' } },
        { model: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [rows, total] = await Promise.all([
      this.prisma.vehicle.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: filters.limit ?? 50,
        skip: filters.offset ?? 0,
      }),
      this.prisma.vehicle.count({ where }),
    ]);

    return {
      items: rows.map(toDomain),
      total,
    };
  }

  async updateStatus(
    id: string,
    scope: { organizationId: string; operatingCompanyId: string },
    status: VehicleStatus,
  ): Promise<FleetVehicle> {
    const row = await this.prisma.vehicle.update({
      where: {
        id_operatingCompanyId: {
          id,
          operatingCompanyId: scope.operatingCompanyId,
        },
      },
      data: { status },
    });

    return toDomain(row);
  }

  async update(
    id: string,
    scope: { organizationId: string; operatingCompanyId: string },
    input: UpdateVehicleInput,
  ): Promise<FleetVehicle> {
    const row = await this.prisma.vehicle.update({
      where: {
        id_operatingCompanyId: {
          id,
          operatingCompanyId: scope.operatingCompanyId,
        },
      },
      data: {
        branchId: input.branchId ?? undefined,
        brand: input.brand,
        model: input.model,
        year: input.year ?? undefined,
        color: input.color ?? undefined,
        category: input.category ?? undefined,
        dailyRate:
          input.dailyRate !== undefined && input.dailyRate !== null
            ? new Prisma.Decimal(input.dailyRate)
            : undefined,
        depositMinimum:
          input.depositMinimum !== undefined && input.depositMinimum !== null
            ? new Prisma.Decimal(input.depositMinimum)
            : undefined,
        passengerCapacity: input.passengerCapacity ?? undefined,
        fuelPrice:
          input.fuelPrice !== undefined && input.fuelPrice !== null
            ? new Prisma.Decimal(input.fuelPrice)
            : undefined,
        photoUrl: input.photoUrl ?? undefined,
      },
    });

    return toDomain(row);
  }
}
