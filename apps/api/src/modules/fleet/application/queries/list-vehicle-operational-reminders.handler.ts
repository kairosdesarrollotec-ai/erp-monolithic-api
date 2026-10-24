import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import { FleetAccessService } from '../services/fleet-access.service';

export interface ListVehicleOperationalRemindersQuery {
  firebaseUid: string;
  companyId: string;
  branchId: string;
  status?: 'PENDING' | 'COMPLETED' | 'OVERDUE';
}

export interface VehicleOperationalReminderItem {
  id: string;
  vehicleId: string;
  plate: string | null;
  formatType: string;
  dueDate: Date;
  status: string;
  completedRecordId: string | null;
  completedAt: Date | null;
  createdAt: Date;
}

export interface ListVehicleOperationalRemindersResult {
  items: VehicleOperationalReminderItem[];
  total: number;
}

@Injectable()
export class ListVehicleOperationalRemindersHandler {
  constructor(
    private readonly access: FleetAccessService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(query: ListVehicleOperationalRemindersQuery): Promise<ListVehicleOperationalRemindersResult> {
    const { scope } = await this.access.authorize(
      {
        firebaseUid: query.firebaseUid,
        companyId: query.companyId,
        branchId: query.branchId,
      },
      'VIEW_VEHICLE_OPERATIONAL_FORMAT',
    );

    const where = {
      operatingCompanyId: scope.operatingCompanyId,
      ...(query.status ? { status: query.status } : {}),
    };

    const [reminders, total] = await Promise.all([
      this.prisma.vehicleFormatReminder.findMany({
        where,
        include: { vehicle: { select: { plate: true } } },
        orderBy: { dueDate: 'asc' },
      }),
      this.prisma.vehicleFormatReminder.count({ where }),
    ]);

    return {
      items: reminders.map((r) => ({
        id: r.id,
        vehicleId: r.vehicleId,
        plate: r.vehicle?.plate ?? null,
        formatType: r.formatType,
        dueDate: r.dueDate,
        status: r.status,
        completedRecordId: r.completedRecordId,
        completedAt: r.completedAt,
        createdAt: r.createdAt,
      })),
      total,
    };
  }
}
