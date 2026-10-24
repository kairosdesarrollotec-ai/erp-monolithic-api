import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import { FleetAccessService } from '../services/fleet-access.service';
import type { VehicleOperationalRecordResult } from '../commands/record-vehicle-operational-format.handler';

export interface ListVehicleOperationalRecordsQuery {
  firebaseUid: string;
  companyId: string;
  branchId: string;
  vehicleId: string;
  formatType?: string;
  limit?: number;
  offset?: number;
}

export interface ListVehicleOperationalRecordsResult {
  items: VehicleOperationalRecordResult[];
  total: number;
}

@Injectable()
export class ListVehicleOperationalRecordsHandler {
  constructor(
    private readonly access: FleetAccessService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(query: ListVehicleOperationalRecordsQuery): Promise<ListVehicleOperationalRecordsResult> {
    const { scope } = await this.access.authorize(
      {
        firebaseUid: query.firebaseUid,
        companyId: query.companyId,
        branchId: query.branchId,
      },
      'VIEW_VEHICLE_OPERATIONAL_FORMAT',
    );

    const vehicle = await this.prisma.vehicle.findFirst({
      where: {
        id: query.vehicleId,
        operatingCompanyId: scope.operatingCompanyId,
      },
    });

    if (!vehicle) {
      throw new NotFoundException({
        code: 'VEHICLE_NOT_FOUND',
        detail: 'Vehículo no encontrado en la empresa.',
      });
    }

    const where = {
      vehicleId: query.vehicleId,
      operatingCompanyId: scope.operatingCompanyId,
      ...(query.formatType ? { formatType: query.formatType } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.vehicleOperationalRecord.findMany({
        where,
        orderBy: { performedAt: 'desc' },
        take: query.limit ?? 50,
        skip: query.offset ?? 0,
      }),
      this.prisma.vehicleOperationalRecord.count({ where }),
    ]);

    return {
      items: items.map((r) => ({
        id: r.id,
        vehicleId: r.vehicleId,
        formatType: r.formatType,
        processType: r.processType,
        processId: r.processId,
        odometerKm: r.odometerKm,
        fuelLevelLines: r.fuelLevelLines,
        data: r.data as Record<string, unknown>,
        observations: r.observations,
        performedBy: r.performedBy,
        performedAt: r.performedAt,
        createdAt: r.createdAt,
      })),
      total,
    };
  }
}
