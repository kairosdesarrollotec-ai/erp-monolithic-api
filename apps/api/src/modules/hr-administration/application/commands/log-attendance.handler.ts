import { Injectable } from '@nestjs/common';
import type { AttendanceRecord, HrMemo } from '@prisma/client';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { HrAdministrationAccessService } from '../services/hr-administration-access.service';
import { HrMemoService } from '../services/hr-memo.service';
import { AttendanceRepositoryPort } from '../ports/attendance-repository.port';
import { EmployeeRepositoryPort } from '../ports/employee-repository.port';
import {
  AttendanceAlreadyLoggedError,
  EmployeeNotFoundError,
  InvalidAttendanceEvidenceError,
  EmployeeTerminatedError,
} from '../../domain/hr-administration-errors';
import { resolveAttendanceRecord } from '../../domain/hr-administration-rules';
import { LogAttendanceCommand, ATTENDANCE_EVIDENCE_KINDS } from './log-attendance.command';

export interface LogAttendanceResult {
  record: AttendanceRecord;
  /** true si el registro no trae evidencia fotografica (DEC-ADP-ATT-EVIDENCE-001: opcional, no bloquea). */
  evidenceMissing: boolean;
  /** Memo de advertencia generado automáticamente por reiteración de faltas injustificadas en el mes (ADP-P03). */
  memo: HrMemo | null;
}

/**
 * ADP-P01..04 / BR-ADP-001: registra asistencia, tardanza o falta. El descuento queda PENDIENTE: la quincena se
 * paga íntegra y los descuentos solo se aplican a fin de mes (ApplyMonthDeductionsHandler).
 */
@Injectable()
export class LogAttendanceHandler {
  constructor(
    private readonly access: HrAdministrationAccessService,
    private readonly attendance: AttendanceRepositoryPort,
    private readonly employees: EmployeeRepositoryPort,
    private readonly transactionManager: TransactionManagerPort,
    private readonly auditRepository: AuditEventRepositoryPort,
    private readonly memos: HrMemoService,
  ) {}

  async execute(command: LogAttendanceCommand): Promise<LogAttendanceResult> {
    const found = await this.employees.findById(command.employeeId);
    if (!found) {
      throw new EmployeeNotFoundError(command.employeeId);
    }

    const { context } = await this.access.authorize(
      {
        firebaseUid: command.firebaseUid,
        companyId: found.operatingCompanyId,
        branchId: found.branchId,
      },
      'LOG_ATTENDANCE',
    );

    const evidence = this.resolveEvidence(command);

    return this.transactionManager.run(async (tx) => {
      const employee = await this.employees.findById(command.employeeId, tx);
      if (!employee) {
        throw new EmployeeNotFoundError(command.employeeId);
      }
      if (employee.status === 'TERMINADO') {
        throw new EmployeeTerminatedError(employee.id);
      }

      const existing = await this.attendance.findByEmployeeAndDate(command.employeeId, command.date, tx);
      if (existing) {
        throw new AttendanceAlreadyLoggedError(command.employeeId, command.date.toISOString().slice(0, 10));
      }

      const resolved = resolveAttendanceRecord({
        status: command.status,
        minutesLate: command.minutesLate,
        deductionAmount: command.deductionAmount,
        baseSalary: employee.baseSalary ? Number(employee.baseSalary) : null,
      });

      const created = await this.attendance.create(
        {
          employeeId: command.employeeId,
          date: command.date,
          checkInTime: command.checkInTime ?? null,
          checkOutTime: command.checkOutTime ?? null,
          status: command.status,
          minutesLate: resolved.minutesLate,
          deductionAmount: resolved.deductionAmount,
          notes: command.notes?.trim() || null,
          createdById: command.firebaseUid,
          evidence,
        },
        tx,
      );

      await this.auditRepository.recordHrAdministrationEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.firebaseUid,
          entityType: 'attendance',
          entityId: created.id,
          action: 'ATTENDANCE_LOGGED',
          changes: {
            employeeId: created.employeeId,
            date: created.date,
            status: created.status,
            minutesLate: created.minutesLate,
            deductionAmount: Number(created.deductionAmount),
            evidenceKind: created.evidenceKind,
            evidenceMissing: !created.evidenceKind,
          },
        },
        tx,
      );

      const memo =
        created.status === 'FALTA_INJUSTIFICADA'
          ? await this.memos.onUnjustifiedAbsence(
              {
                organizationId: context.organizationId,
                employeeId: created.employeeId,
                attendanceId: created.id,
                date: created.date,
              },
              tx,
            )
          : null;

      return { record: created, memo, evidenceMissing: !created.evidenceKind };
    });
  }

  /**
   * DEC-ADP-ATT-EVIDENCE-001: valida la evidencia fotografica (opcional) y registra quien la corroboro (el usuario
   * autenticado que registra la marcacion tras ver la foto en el grupo de WhatsApp).
   */
  private resolveEvidence(command: LogAttendanceCommand) {
    const ev = command.evidence;
    if (!ev) return null;
    if (!(ATTENDANCE_EVIDENCE_KINDS as readonly string[]).includes(ev.kind)) {
      throw new InvalidAttendanceEvidenceError(`Tipo de evidencia no admitido (${ev.kind}).`);
    }
    const storageRef = ev.storageRef?.trim() || null;
    const url = ev.url?.trim() || null;
    if (!storageRef && !url) {
      throw new InvalidAttendanceEvidenceError('La evidencia requiere storageRef o url de la foto.');
    }
    if (Number.isNaN(ev.capturedAtLocal.getTime())) {
      throw new InvalidAttendanceEvidenceError('capturedAtLocal no es una fecha y hora valida.');
    }
    const now = new Date();
    if (ev.capturedAtLocal.getTime() > now.getTime() + 5 * 60 * 1000) {
      throw new InvalidAttendanceEvidenceError('capturedAtLocal no puede estar en el futuro.');
    }
    return {
      kind: ev.kind,
      storageRef,
      url,
      capturedAt: ev.capturedAtLocal,
      note: ev.note?.trim() || null,
      corroboratedById: command.firebaseUid,
      corroboratedAt: now,
    };
  }
}
