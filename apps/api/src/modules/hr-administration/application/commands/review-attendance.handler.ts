import { Injectable } from '@nestjs/common';
import type { AttendanceRecord, AttendanceStatus } from '@prisma/client';
import { ClockPort } from '../../../../common/application/ports/clock.port';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { HrAdministrationAccessService } from '../services/hr-administration-access.service';
import { AttendanceRepositoryPort } from '../ports/attendance-repository.port';
import {
  AttendanceNotPendingReviewError,
  AttendanceNotReclassifiableError,
  AttendanceRecordNotFoundError,
  InvalidAttendanceReviewError,
} from '../../domain/hr-administration-errors';
import { resolveAttendanceRecord } from '../../domain/hr-administration-rules';
import { ReviewAttendanceCommand } from './self-attendance.commands';

export interface ReviewAttendanceResult {
  record: AttendanceRecord;
  employeeName: string;
}

/**
 * 22-oct (#9): Gerencia/Administracion aprueban o corrigen las marcas fuera de la geocerca. CORRECT exige nota y al menos
 * un cambio (estado o minutos de tardanza); recalcula el descuento con la misma regla que el registro (BR-ADP-001).
 */
@Injectable()
export class ReviewAttendanceHandler {
  constructor(
    private readonly access: HrAdministrationAccessService,
    private readonly attendance: AttendanceRepositoryPort,
    private readonly transactionManager: TransactionManagerPort,
    private readonly clock: ClockPort,
    private readonly auditRepository: AuditEventRepositoryPort,
  ) {}

  async execute(command: ReviewAttendanceCommand): Promise<ReviewAttendanceResult> {
    const found = await this.attendance.findById(command.attendanceId);
    if (!found) throw new AttendanceRecordNotFoundError(command.attendanceId);

    const { context } = await this.access.authorize(
      {
        firebaseUid: command.firebaseUid,
        companyId: found.employee.operatingCompanyId,
        branchId: found.employee.branchId,
      },
      'REVIEW_ATTENDANCE',
    );

    return this.transactionManager.run(async (tx) => {
      const current = await this.attendance.findById(command.attendanceId, tx);
      if (!current) throw new AttendanceRecordNotFoundError(command.attendanceId);
      if (current.reviewStatus !== 'PENDING') throw new AttendanceNotPendingReviewError();
      if (current.isDeductionApplied) {
        throw new AttendanceNotReclassifiableError('El descuento de esta marca ya se aplicó en la liquidación del mes.');
      }

      const note = command.note?.trim() || null;
      let change: { status: AttendanceStatus; minutesLate: number; deductionAmount: number } | null = null;

      if (command.decision === 'CORRECT') {
        if (!note) throw new InvalidAttendanceReviewError('Corregir una marca requiere la nota (note) con el motivo.');
        if (command.status == null && command.minutesLate == null) {
          throw new InvalidAttendanceReviewError('Corregir una marca requiere indicar status y/o minutesLate.');
        }
        const status = (command.status ?? current.status) as AttendanceStatus;
        const minutesLate = command.minutesLate ?? current.minutesLate;
        if (status === current.status && (status !== 'TARDANZA' || minutesLate === current.minutesLate)) {
          throw new InvalidAttendanceReviewError('La corrección no cambia el estado ni los minutos de la marca.');
        }
        const resolved = resolveAttendanceRecord({
          status,
          minutesLate,
          baseSalary: current.employee.baseSalary ? Number(current.employee.baseSalary) : null,
        });
        change = { status, minutesLate: resolved.minutesLate, deductionAmount: resolved.deductionAmount };
      }

      const updated = await this.attendance.review(
        current.id,
        {
          reviewStatus: change ? 'CORRECTED' : 'APPROVED',
          reviewedById: command.firebaseUid,
          reviewedAt: this.clock.now(),
          reviewNote: note,
          ...(change ?? {}),
        },
        tx,
      );
      if (!updated) throw new AttendanceNotPendingReviewError();

      await this.auditRepository.recordHrAdministrationEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.firebaseUid,
          entityType: 'attendance',
          entityId: updated.id,
          action: 'ATTENDANCE_REVIEWED',
          changes: {
            employeeId: updated.employeeId,
            date: updated.date,
            decision: command.decision,
            previousStatus: current.status,
            status: updated.status,
            previousMinutesLate: current.minutesLate,
            minutesLate: updated.minutesLate,
            deductionAmount: Number(updated.deductionAmount),
            note,
          },
        },
        tx,
      );
      return { record: updated, employeeName: current.employee.fullName };
    });
  }
}
