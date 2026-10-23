import { Injectable } from '@nestjs/common';
import type { AttendanceRecord } from '@prisma/client';
import { limaTodayString } from '../../../../common/time/lima-time';
import { HrAdministrationAccessService } from '../services/hr-administration-access.service';
import { AttendanceRepositoryPort, AttendanceWithEmployee } from '../ports/attendance-repository.port';
import { BranchGeofenceRepositoryPort } from '../ports/branch-geofence-repository.port';
import { isGeofenceConfigured } from '../../domain/attendance-self-service-rules';
import { GetMyEmployeeHandler } from './get-my-employee.handler';
import { GetMyEmployeeQuery } from './get-my-employee.query';

export interface MyAttendanceResult {
  employeeId: string;
  geofence: { configured: boolean; latitude: number | null; longitude: number | null; radiusMeters: number | null };
  items: AttendanceRecord[];
}

/** 22-oct (#9): marcas propias del mes y la geocerca de la sede (para que la app muestre el estado antes de marcar). */
@Injectable()
export class GetMyAttendanceHandler {
  constructor(
    private readonly access: HrAdministrationAccessService,
    private readonly myEmployee: GetMyEmployeeHandler,
    private readonly attendance: AttendanceRepositoryPort,
    private readonly geofences: BranchGeofenceRepositoryPort,
  ) {}

  async execute(input: {
    firebaseUid: string;
    companyId: string;
    branchId: string;
    month?: string;
  }): Promise<MyAttendanceResult> {
    await this.access.authorize(
      { firebaseUid: input.firebaseUid, companyId: input.companyId, branchId: input.branchId },
      'LOG_OWN_ATTENDANCE',
    );
    const employee = await this.myEmployee.execute(
      new GetMyEmployeeQuery(input.firebaseUid, input.companyId, input.branchId),
    );
    const month = input.month ?? limaTodayString().slice(0, 7);
    const [items, fence] = await Promise.all([
      this.attendance.findManyByEmployee(employee.id, { month }),
      this.geofences.find(input.companyId, input.branchId),
    ]);
    const configured = isGeofenceConfigured(fence);
    return {
      employeeId: employee.id,
      geofence: {
        configured,
        latitude: configured ? fence!.latitude : null,
        longitude: configured ? fence!.longitude : null,
        radiusMeters: configured ? fence!.radiusMeters : null,
      },
      items,
    };
  }
}

/** 22-oct (#9): bandeja de marcas fuera de geocerca pendientes de revision. */
@Injectable()
export class ListAttendancePendingReviewHandler {
  constructor(
    private readonly access: HrAdministrationAccessService,
    private readonly attendance: AttendanceRepositoryPort,
  ) {}

  async execute(input: {
    firebaseUid: string;
    companyId: string;
    branchId: string;
    limit?: number;
  }): Promise<AttendanceWithEmployee[]> {
    await this.access.authorize(
      { firebaseUid: input.firebaseUid, companyId: input.companyId, branchId: input.branchId },
      'REVIEW_ATTENDANCE',
    );
    return this.attendance.findPendingReview(input.companyId, Math.min(Math.max(input.limit ?? 100, 1), 200));
  }
}
