import { Injectable } from '@nestjs/common';
import type { AttendanceRecord, HrMemo } from '@prisma/client';
import { ClockPort } from '../../../../common/application/ports/clock.port';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { HrAdministrationAccessService } from '../services/hr-administration-access.service';
import { HrMemoService } from '../services/hr-memo.service';
import { AttendanceRepositoryPort } from '../ports/attendance-repository.port';
import {
  AttendanceNotReclassifiableError,
  AttendanceRecordNotFoundError,
} from '../../domain/hr-administration-errors';
import { resolveReclassification } from '../../domain/hr-administration-rules';
import { ReclassifyAttendanceCommand } from './reclassify-attendance.command';

export interface ReclassifyAttendanceResult {
  record: AttendanceRecord;
  employeeName: string;
  memo: HrMemo | null;
}

/**
 * ADP-P04 / ADP-03 / DAT-ADP-002: reclasifica una falta como JUSTIFICADA o INJUSTIFICADA con su justificación.
 * El descuento lo calcula el sistema (justificada = sin descuento) y sigue pendiente hasta el cierre de mes
 * (BR-ADP-001); una falta cuyo descuento ya se liquidó no se toca. Reclasificar a injustificada vuelve a evaluar la
 * reiteración del mes (el memo es idempotente por registro).
 */
@Injectable()
export class ReclassifyAttendanceHandler {
  constructor(
    private readonly access: HrAdministrationAccessService,
    private readonly attendance: AttendanceRepositoryPort,
    private readonly transactionManager: TransactionManagerPort,
    private readonly clock: ClockPort,
    private readonly auditRepository: AuditEventRepositoryPort,
    private readonly memos: HrMemoService,
  ) {}

  async execute(command: ReclassifyAttendanceCommand): Promise<ReclassifyAttendanceResult> {
    const found = await this.attendance.findById(command.attendanceId);
    if (!found) {
      throw new AttendanceRecordNotFoundError(command.attendanceId);
    }

    const { context } = await this.access.authorize(
      {
        firebaseUid: command.firebaseUid,
        companyId: found.employee.operatingCompanyId,
        branchId: found.employee.branchId,
      },
      'LOG_ATTENDANCE',
    );

    return this.transactionManager.run(async (tx) => {
      const current = await this.attendance.findById(command.attendanceId, tx);
      if (!current) {
        throw new AttendanceRecordNotFoundError(command.attendanceId);
      }

      const resolved = resolveReclassification({
        currentStatus: current.status,
        isDeductionApplied: current.isDeductionApplied,
        targetStatus: command.status,
        justification: command.justification,
        baseSalary: current.employee.baseSalary ? Number(current.employee.baseSalary) : null,
      });

      const updated = await this.attendance.reclassify(
        current.id,
        {
          status: resolved.status,
          deductionAmount: resolved.deductionAmount,
          justification: resolved.justification,
          reclassifiedById: command.firebaseUid,
          reclassifiedAt: this.clock.now(),
        },
        tx,
      );
      if (!updated) {
        // Otra operación la liquidó o la cambió entre la lectura y la escritura.
        throw new AttendanceNotReclassifiableError(
          'La falta cambió mientras se reclasificaba (por ejemplo, se liquidó el descuento del mes). Revisa su estado actual.',
        );
      }

      await this.auditRepository.recordHrAdministrationEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.firebaseUid,
          entityType: 'attendance',
          entityId: updated.id,
          action: 'ATTENDANCE_RECLASSIFIED',
          changes: {
            employeeId: updated.employeeId,
            date: updated.date,
            previousStatus: current.status,
            status: updated.status,
            deductionAmount: Number(updated.deductionAmount),
            justification: updated.justification,
          },
        },
        tx,
      );

      const memo =
        updated.status === 'FALTA_INJUSTIFICADA'
          ? await this.memos.onUnjustifiedAbsence(
              {
                organizationId: context.organizationId,
                employeeId: updated.employeeId,
                attendanceId: updated.id,
                date: updated.date,
              },
              tx,
            )
          : null;

      return { record: updated, employeeName: current.employee.fullName, memo };
    });
  }
}
