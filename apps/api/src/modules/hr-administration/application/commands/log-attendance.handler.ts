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
  AttendanceEvidenceRequiredError,
  InvalidAttendanceRecordError,
} from '../../domain/hr-administration-errors';
import {
  ATTENDANCE_STATUSES_REQUIRING_EVIDENCE,
  attendanceEvidenceKeyPrefix,
  resolveAttendanceRecord,
} from '../../domain/hr-administration-rules';
import { resolveOnBehalfReason } from '../../domain/attendance-self-service-rules';
import { LogAttendanceCommand, ATTENDANCE_EVIDENCE_KINDS } from './log-attendance.command';

export interface LogAttendanceResult {
  record: AttendanceRecord;
  /** true si el registro no trae evidencia (solo historicos y faltas; los registros nuevos de presencia la exigen, DEC-ADP-ATT-EVIDENCE-002). */
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

    const onBehalfReason = resolveOnBehalfReason(command.status, command.reason);
    const evidence = this.resolveEvidence(command, found.operatingCompanyId);
    const location = resolveAttendanceLocation(command.location);

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
          source: 'ON_BEHALF',
          onBehalfReason,
          ...location,
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
            locationCaptured: created.latitude !== null && created.longitude !== null,
            source: 'ON_BEHALF',
            onBehalfOfEmployeeId: created.employeeId,
            onBehalfReason,
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
   * DEC-ADP-ATT-EVIDENCE-002: la evidencia fotografica es OBLIGATORIA en marcaciones de presencia (PRESENTE/TARDANZA)
   * y se registra quien la corroboro. Las faltas y permisos no tienen foto posible: evidencia opcional.
   */
  private resolveEvidence(command: LogAttendanceCommand, companyId: string) {
    if (!command.evidence) {
      if (ATTENDANCE_STATUSES_REQUIRING_EVIDENCE.includes(command.status)) {
        throw new AttendanceEvidenceRequiredError();
      }
      return null;
    }
    return buildAttendanceEvidence(command.evidence, {
      companyId,
      employeeId: command.employeeId,
      corroboratedById: command.firebaseUid,
      now: new Date(),
    });
  }
}

/**
 * Valida y normaliza la foto de asistencia. Si trae `storageRef`, debe ser un objeto subido con la URL firmada de ESTE
 * colaborador (prefijo de empresa/colaborador). Compartida por el registro a nombre de otro y por la marca propia.
 */
export function buildAttendanceEvidence(
  ev: NonNullable<LogAttendanceCommand['evidence']>,
  ctx: { companyId: string; employeeId: string; corroboratedById: string; now: Date },
) {
  if (!(ATTENDANCE_EVIDENCE_KINDS as readonly string[]).includes(ev.kind)) {
    throw new InvalidAttendanceEvidenceError(`Tipo de evidencia no admitido (${ev.kind}).`);
  }
  const storageRef = ev.storageRef?.trim() || null;
  const url = ev.url?.trim() || null;
  if (!storageRef && !url) {
    throw new InvalidAttendanceEvidenceError('La evidencia requiere storageRef o url de la foto.');
  }
  if (storageRef && !storageRef.startsWith(attendanceEvidenceKeyPrefix(ctx.companyId, ctx.employeeId))) {
    throw new InvalidAttendanceEvidenceError(
      'storageRef no corresponde a una foto subida para este colaborador (usa la URL firmada de asistencia).',
    );
  }
  if (Number.isNaN(ev.capturedAtLocal.getTime())) {
    throw new InvalidAttendanceEvidenceError('capturedAtLocal no es una fecha y hora valida.');
  }
  if (ev.capturedAtLocal.getTime() > ctx.now.getTime() + 5 * 60 * 1000) {
    throw new InvalidAttendanceEvidenceError('capturedAtLocal no puede estar en el futuro.');
  }
  return {
    kind: ev.kind,
    storageRef,
    url,
    capturedAt: ev.capturedAtLocal,
    note: ev.note?.trim() || null,
    corroboratedById: ctx.corroboratedById,
    corroboratedAt: ctx.now,
  };
}

/**
 * HU-29 (Respuestas 2026-10-20 #20): la ubicacion automatica es OPCIONAL; si no viene, el registro sigue igual. Si viene, se valida
 * el rango (latitud -90..90, longitud -180..180, precision 0..100000 m) y latitud/longitud deben ir juntas.
 */
export function resolveAttendanceLocation(
  location: LogAttendanceCommand['location'],
): { latitude: number | null; longitude: number | null; accuracy: number | null } {
  if (!location) return { latitude: null, longitude: null, accuracy: null };
  const { latitude, longitude, accuracy } = location;
  const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
  if (!finite(latitude) || !finite(longitude)) {
    throw new InvalidAttendanceRecordError('La ubicación requiere latitude y longitude numéricas.');
  }
  if (latitude < -90 || latitude > 90) throw new InvalidAttendanceRecordError('latitude debe estar entre -90 y 90.');
  if (longitude < -180 || longitude > 180) throw new InvalidAttendanceRecordError('longitude debe estar entre -180 y 180.');
  if (accuracy !== undefined && accuracy !== null && (!finite(accuracy) || accuracy < 0 || accuracy > 100000)) {
    throw new InvalidAttendanceRecordError('accuracy debe estar entre 0 y 100000 metros.');
  }
  return { latitude, longitude, accuracy: accuracy ?? null };
}
