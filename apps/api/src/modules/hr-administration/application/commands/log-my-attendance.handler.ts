import { Injectable } from '@nestjs/common';
import type { AttendanceRecord } from '@prisma/client';
import { ClockPort } from '../../../../common/application/ports/clock.port';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { toLimaDateString } from '../../../../common/time/lima-time';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { HrAdministrationAccessService } from '../services/hr-administration-access.service';
import { AttendanceRepositoryPort } from '../ports/attendance-repository.port';
import { BranchGeofenceRepositoryPort } from '../ports/branch-geofence-repository.port';
import { GetMyEmployeeHandler } from '../queries/get-my-employee.handler';
import { GetMyEmployeeQuery } from '../queries/get-my-employee.query';
import {
  AttendanceAlreadyLoggedError,
  AttendanceCheckInRequiredError,
  AttendanceEvidenceRequiredError,
  AttendanceMarkAlreadyLoggedError,
  AttendanceSelfStatusNotAllowedError,
  EmployeeTerminatedError,
} from '../../domain/hr-administration-errors';
import {
  SELF_ATTENDANCE_STATUSES,
  assertCapturedAtAcceptable,
  assertSelfLocation,
  evaluateGeofence,
} from '../../domain/attendance-self-service-rules';
import { resolveAttendanceRecord } from '../../domain/hr-administration-rules';
import { buildAttendanceEvidence } from './log-attendance.handler';
import { LogMyAttendanceCommand } from './self-attendance.commands';

export interface LogMyAttendanceResult {
  record: AttendanceRecord;
  /** true si la marca quedo fuera de la geocerca y espera revision de Gerencia/Administracion. */
  requiresReview: boolean;
}

/**
 * 22-oct (Respuestas #9, opcion 2): el colaborador marca su propia entrada/salida desde su cuenta. Foto obligatoria en la
 * entrada, ubicacion obligatoria (solo al marcar), geocerca de la sede, una marca por dia y tipo, hora del dispositivo con
 * tope de antiguedad (marcas offline). Fuera de rango => se guarda con revision PENDING (no se rechaza).
 */
@Injectable()
export class LogMyAttendanceHandler {
  constructor(
    private readonly access: HrAdministrationAccessService,
    private readonly myEmployee: GetMyEmployeeHandler,
    private readonly attendance: AttendanceRepositoryPort,
    private readonly geofences: BranchGeofenceRepositoryPort,
    private readonly transactionManager: TransactionManagerPort,
    private readonly auditRepository: AuditEventRepositoryPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: LogMyAttendanceCommand): Promise<LogMyAttendanceResult> {
    const { context } = await this.access.authorize(
      { firebaseUid: command.firebaseUid, companyId: command.companyId, branchId: command.branchId },
      'LOG_OWN_ATTENDANCE',
    );
    const employee = await this.myEmployee.execute(
      new GetMyEmployeeQuery(command.firebaseUid, command.companyId, command.branchId),
    );
    if (employee.status === 'TERMINADO') throw new EmployeeTerminatedError(employee.id);

    const isCheckIn = command.type === 'CHECK_IN';
    if (isCheckIn && !SELF_ATTENDANCE_STATUSES.includes(command.status)) {
      throw new AttendanceSelfStatusNotAllowedError(command.status);
    }

    const now = this.clock.now();
    assertCapturedAtAcceptable(command.capturedAt, now);
    const point = assertSelfLocation(command.location);

    let evidence: ReturnType<typeof buildAttendanceEvidence> | null = null;
    if (isCheckIn) {
      if (!command.evidence) throw new AttendanceEvidenceRequiredError();
      evidence = buildAttendanceEvidence(command.evidence, {
        companyId: employee.operatingCompanyId,
        employeeId: employee.id,
        corroboratedById: command.firebaseUid,
        now,
      });
    }

    const resolved = isCheckIn
      ? resolveAttendanceRecord({
          status: command.status,
          minutesLate: command.minutesLate,
          baseSalary: employee.baseSalary ? Number(employee.baseSalary) : null,
        })
      : null;

    const branchGeofence = await this.geofences.find(command.companyId, command.branchId);
    const geo = evaluateGeofence(point, branchGeofence);

    // Dia de la marca = dia de Lima de la hora del dispositivo.
    const date = new Date(`${toLimaDateString(command.capturedAt)}T00:00:00.000Z`);

    return this.transactionManager.run(async (tx) => {
      const existing = await this.attendance.findByEmployeeAndDate(employee.id, date, tx);

      if (!isCheckIn) {
        if (!existing || existing.source !== 'SELF') throw new AttendanceCheckInRequiredError();
        if (existing.checkOutCapturedAt) throw new AttendanceMarkAlreadyLoggedError('CHECK_OUT');
        const updated = await this.attendance.recordCheckOut(
          existing.id,
          {
            checkOutTime: command.capturedAt,
            capturedAt: command.capturedAt,
            latitude: point.latitude,
            longitude: point.longitude,
            accuracy: point.accuracy,
            outsideGeofence: geo.outsideGeofence,
            distanceMeters: geo.distanceMeters,
          },
          tx,
        );
        if (!updated) throw new AttendanceMarkAlreadyLoggedError('CHECK_OUT');
        await this.audit(context.organizationId, command, updated, 'CHECK_OUT', geo, tx);
        return { record: updated, requiresReview: updated.reviewStatus === 'PENDING' };
      }

      if (existing) {
        throw new AttendanceAlreadyLoggedError(employee.id, date.toISOString().slice(0, 10));
      }
      const created = await this.attendance.create(
        {
          employeeId: employee.id,
          date,
          checkInTime: command.capturedAt,
          status: command.status as 'PRESENTE' | 'TARDANZA',
          minutesLate: resolved!.minutesLate,
          deductionAmount: resolved!.deductionAmount,
          notes: command.notes?.trim() || null,
          createdById: command.firebaseUid,
          latitude: point.latitude,
          longitude: point.longitude,
          accuracy: point.accuracy,
          source: 'SELF',
          capturedAt: command.capturedAt,
          outsideGeofence: geo.outsideGeofence,
          distanceMeters: geo.distanceMeters,
          geofenceRadiusMeters: geo.radiusMeters,
          reviewStatus: geo.outsideGeofence ? 'PENDING' : null,
          evidence,
        },
        tx,
      );
      await this.audit(context.organizationId, command, created, 'CHECK_IN', geo, tx);
      return { record: created, requiresReview: created.reviewStatus === 'PENDING' };
    });
  }

  private async audit(
    organizationId: string,
    command: LogMyAttendanceCommand,
    record: AttendanceRecord,
    type: 'CHECK_IN' | 'CHECK_OUT',
    geo: ReturnType<typeof evaluateGeofence>,
    tx: Parameters<AttendanceRepositoryPort['findById']>[1],
  ): Promise<void> {
    const receivedAt = this.clock.now();
    const isDeferred = Math.abs(receivedAt.getTime() - command.capturedAt.getTime()) > 60_000;
    await this.auditRepository.recordHrAdministrationEvent(
      {
        organizationId,
        actorUserId: command.firebaseUid,
        entityType: 'attendance',
        entityId: record.id,
        action: 'ATTENDANCE_SELF_LOGGED',
        changes: {
          type,
          employeeId: record.employeeId,
          date: record.date,
          status: record.status,
          minutesLate: record.minutesLate,
          capturedAt: command.capturedAt,
          receivedAt,
          isDeferred,
          geofenceEvaluated: geo.evaluated,
          outsideGeofence: geo.outsideGeofence,
          distanceMeters: geo.distanceMeters,
          radiusMeters: geo.radiusMeters,
          requiresReview: record.reviewStatus === 'PENDING',
        },
      },
      tx,
    );
  }
}
