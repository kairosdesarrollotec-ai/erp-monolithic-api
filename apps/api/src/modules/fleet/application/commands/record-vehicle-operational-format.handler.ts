import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import { ClockPort } from '../../../../common/application/ports/clock.port';
import { FleetAccessService } from '../services/fleet-access.service';
import { isValidOperationalFormat } from '../../domain/vehicle-operational-format';
import { RecordVehicleOperationalFormatCommand } from './record-vehicle-operational-format.command';

export interface VehicleOperationalRecordResult {
  id: string;
  vehicleId: string;
  formatType: string;
  processType: string | null;
  processId: string | null;
  odometerKm: number | null;
  fuelLevelLines: number | null;
  data: Record<string, unknown>;
  observations: string | null;
  performedBy: string;
  performedAt: Date;
  createdAt: Date;
}

@Injectable()
export class RecordVehicleOperationalFormatHandler {
  constructor(
    private readonly access: FleetAccessService,
    private readonly prisma: PrismaService,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: RecordVehicleOperationalFormatCommand): Promise<VehicleOperationalRecordResult> {
    if (!isValidOperationalFormat(command.formatType)) {
      throw new BadRequestException({
        code: 'INVALID_OPERATIONAL_FORMAT',
        detail: `El formato operativo "${command.formatType}" no es válido.`,
      });
    }

    const { scope } = await this.access.authorize(
      {
        firebaseUid: command.firebaseUid,
        companyId: command.companyId,
        branchId: command.branchId,
      },
      'REGISTER_VEHICLE_OPERATIONAL_FORMAT',
    );

    const vehicle = await this.prisma.vehicle.findFirst({
      where: {
        id: command.vehicleId,
        operatingCompanyId: scope.operatingCompanyId,
      },
    });

    if (!vehicle) {
      throw new NotFoundException({
        code: 'VEHICLE_NOT_FOUND',
        detail: 'Vehículo no encontrado en la empresa.',
      });
    }

    const now = this.clock.now();
    const performedAt = command.performedAt ?? now;

    const result = await this.prisma.$transaction(async (tx) => {
      const record = await tx.vehicleOperationalRecord.create({
        data: {
          organizationId: scope.organizationId,
          operatingCompanyId: scope.operatingCompanyId,
          branchId: scope.branchId,
          vehicleId: command.vehicleId,
          formatType: command.formatType,
          processType: command.processType ?? null,
          processId: command.processId ?? null,
          odometerKm: command.odometerKm ?? null,
          fuelLevelLines: command.fuelLevelLines ?? null,
          data: (command.data ?? {}) as Prisma.InputJsonValue,
          observations: command.observations ?? null,
          performedBy: command.performedBy,
          performedAt,
        },
      });

      // Llenar el formato cierra recordatorios pendientes o vencidos (R5)
      await tx.vehicleFormatReminder.updateMany({
        where: {
          vehicleId: command.vehicleId,
          formatType: command.formatType,
          status: { in: ['PENDING', 'OVERDUE'] },
        },
        data: {
          status: 'COMPLETED',
          completedRecordId: record.id,
          completedAt: now,
        },
      });

      return record;
    });

    return {
      id: result.id,
      vehicleId: result.vehicleId,
      formatType: result.formatType,
      processType: result.processType,
      processId: result.processId,
      odometerKm: result.odometerKm,
      fuelLevelLines: result.fuelLevelLines,
      data: result.data as Record<string, unknown>,
      observations: result.observations,
      performedBy: result.performedBy,
      performedAt: result.performedAt,
      createdAt: result.createdAt,
    };
  }
}
