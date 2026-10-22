import { Injectable } from '@nestjs/common';
import type { Branch } from '@prisma/client';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import {
  BranchGeofenceRecord,
  BranchGeofenceRepositoryPort,
} from '../../application/ports/branch-geofence-repository.port';

function toRecord(b: Branch): BranchGeofenceRecord {
  return {
    branchId: b.id,
    branchName: b.name,
    latitude: b.latitude,
    longitude: b.longitude,
    radiusMeters: b.geofenceRadiusMeters,
    updatedBy: b.geofenceUpdatedBy,
    updatedAt: b.geofenceUpdatedAt,
  };
}

@Injectable()
export class PrismaBranchGeofenceRepository implements BranchGeofenceRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async find(companyId: string, branchId: string): Promise<BranchGeofenceRecord | null> {
    const b = await this.prisma.branch.findFirst({ where: { id: branchId, companyId } });
    return b ? toRecord(b) : null;
  }

  async set(
    companyId: string,
    branchId: string,
    data: { latitude: number; longitude: number; radiusMeters: number; updatedBy: string; updatedAt: Date },
  ): Promise<BranchGeofenceRecord | null> {
    const result = await this.prisma.branch.updateMany({
      where: { id: branchId, companyId },
      data: {
        latitude: data.latitude,
        longitude: data.longitude,
        geofenceRadiusMeters: data.radiusMeters,
        geofenceUpdatedBy: data.updatedBy,
        geofenceUpdatedAt: data.updatedAt,
      },
    });
    return result.count === 0 ? null : this.find(companyId, branchId);
  }

  async clear(
    companyId: string,
    branchId: string,
    data: { updatedBy: string; updatedAt: Date },
  ): Promise<BranchGeofenceRecord | null> {
    const result = await this.prisma.branch.updateMany({
      where: { id: branchId, companyId },
      data: {
        latitude: null,
        longitude: null,
        geofenceRadiusMeters: null,
        geofenceUpdatedBy: data.updatedBy,
        geofenceUpdatedAt: data.updatedAt,
      },
    });
    return result.count === 0 ? null : this.find(companyId, branchId);
  }
}
