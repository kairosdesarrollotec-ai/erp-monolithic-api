import { LIMA_UTC_OFFSET_HOURS } from '../../../common/time/lima-time';
import {
  AttendanceNotReclassifiableError,
  DeductionsBeforeMonthEndError,
  FieldTripRejectionReasonRequiredError,
  InvalidAttendanceReclassificationError,
  EmployeeStatusTransitionNotAllowedError,
  FinalSettlementRequiredError,
  FieldTripNotPendingError,
  InvalidAttendanceRecordError,
  InvalidAuthorizationLevelError,
  AuthorizationLevelNotReachedError,
  InvalidPayrollMonthError,
  InvalidTerminationNoticeError,
  TerminationNotesRequiredError,
  VacationOverlapError,
} from './hr-administration-errors';

/** BR-ADP-004: minutos que cada nivel de la cascada tiene para responder. */
export const FIELD_TRIP_LEVEL_TIMEOUT_MINUTES = 5;

/** BR-ADP-005: a partir de la 4ta tardanza al regresar de campo la persona queda observada. */
export const FIELD_TRIP_OBSERVED_THRESHOLD = 4;

/** BR-ADP-006: aviso de un despido por reincidencia. */
export const DISMISSAL_NOTICE_DAYS = 15;

export interface VacationRange {
  id?: string;
  employeeId: string;
  areaId: string;
  startDate: Date;
  endDate: Date;
  status: string;
  requestedAt?: Date;
}

/** Estados de vacaciones que ocupan el cupo del área (BR-ADP-002). CANCELADA y COMPLETADA liberan el cupo. */
export const VACATION_CAPACITY_STATUSES = ['SOLICITADA', 'PROGRAMADA', 'REPROGRAMADA'] as const;

/**
 * BR-ADP-002 / DR-ADP-001: capacidad de área para vacaciones (máximo 1 persona del área de vacaciones a la vez,
 * sin importar cuántos colaboradores tenga el área; NO son "2 personas clave").
 * `existingVacations` llega ordenado por orden de solicitud: quien solicitó primero ya ocupa el cupo, por lo que la
 * solicitud nueva (posterior) es la que se rechaza. Un colaborador tampoco puede solapar sus propias vacaciones.
 */
export function validateVacationAreaCapacity(
  existingVacations: VacationRange[],
  newVacation: VacationRange,
  areaName: string,
): void {
  for (const existing of existingVacations) {
    if (existing.id && newVacation.id && existing.id === newVacation.id) {
      continue;
    }
    if (!(VACATION_CAPACITY_STATUSES as readonly string[]).includes(existing.status)) {
      continue;
    }

    const overlap = existing.startDate <= newVacation.endDate && existing.endDate >= newVacation.startDate;
    if (overlap) {
      throw new VacationOverlapError(
        areaName,
        `Conflicto de superposición en el área ${areaName}: ya hay vacaciones ${existing.status.toLowerCase()} del ${existing.startDate.toISOString().slice(0, 10)} al ${existing.endDate.toISOString().slice(0, 10)}. La capacidad máxima es de 1 persona del área a la vez y tiene prioridad quien solicitó primero (BR-ADP-002, DR-ADP-001).`,
      );
    }
  }
}

/**
 * BR-ADP-004 / DR-ADP-002: cascada de autorización de salidas a campo de EXACTAMENTE 3 niveles con 5 min por nivel.
 * Nivel 1 de 3 -> Nivel 2 de 3 -> Nivel 3 de 3 (genérico: quién autoriza lo define el permiso, no una persona). Si nadie responde tras el nivel 3 el estado
 * pasa a NO_AUTORIZADA. NO existe un 4to nivel automático ni aprobación por defecto (decisión 31 ago 2026).
 */
export function getNextCascadeStatus(
  currentStatus: string,
  fieldTripId = 'unknown',
): {
  nextStatus: 'PENDIENTE_NIVEL_2' | 'PENDIENTE_NIVEL_3' | 'NO_AUTORIZADA';
  message?: string;
} {
  switch (currentStatus) {
    case 'PENDIENTE_NIVEL_1':
      return { nextStatus: 'PENDIENTE_NIVEL_2' };
    case 'PENDIENTE_NIVEL_2':
      return { nextStatus: 'PENDIENTE_NIVEL_3' };
    case 'PENDIENTE_NIVEL_3':
      return {
        nextStatus: 'NO_AUTORIZADA',
        message:
          'Nadie autorizó tras agotar los 3 niveles de la cascada. La persona no sale; la decisión de a quién más consultar es manual, fuera del sistema (BR-ADP-004, DR-ADP-002).',
      };
    default:
      throw new FieldTripNotPendingError(fieldTripId, currentStatus);
  }
}

/** Nivel (1..3) que está esperando respuesta, o null si la salida no está pendiente. */
export function pendingLevelOf(status: string): 1 | 2 | 3 | null {
  switch (status) {
    case 'PENDIENTE_NIVEL_1':
      return 1;
    case 'PENDIENTE_NIVEL_2':
      return 2;
    case 'PENDIENTE_NIVEL_3':
      return 3;
    default:
      return null;
  }
}

/** Valida nivel de autorización: exactamente 1, 2 o 3. NUNCA 4. */
export function validateAuthorizationLevel(level: number): void {
  if (!Number.isInteger(level) || level < 1 || level > 3) {
    throw new InvalidAuthorizationLevelError(level);
  }
}

/**
 * La cascada no salta niveles: solo se puede autorizar en un nivel ya alcanzado (<= nivel pendiente actual).
 * Un nivel inferior sigue siendo válido mientras la salida esté pendiente (nadie la ha negado).
 */
export function assertAuthorizationLevelReached(requestedLevel: number, status: string, fieldTripId: string): void {
  const current = pendingLevelOf(status);
  if (current === null) {
    throw new FieldTripNotPendingError(fieldTripId, status);
  }
  if (requestedLevel > current) {
    throw new AuthorizationLevelNotReachedError(requestedLevel, current);
  }
}

/** Fecha en que vence el temporizador del nivel pendiente actual, o null si aún no se calculó. */
export function currentLevelTimeoutAt(fieldTrip: {
  status: string;
  level1TimeoutAt: Date | null;
  level2TimeoutAt: Date | null;
  level3TimeoutAt: Date | null;
}): Date | null {
  switch (fieldTrip.status) {
    case 'PENDIENTE_NIVEL_1':
      return fieldTrip.level1TimeoutAt;
    case 'PENDIENTE_NIVEL_2':
      return fieldTrip.level2TimeoutAt;
    case 'PENDIENTE_NIVEL_3':
      return fieldTrip.level3TimeoutAt;
    default:
      return null;
  }
}

export function levelTimeoutFrom(now: Date): Date {
  return new Date(now.getTime() + FIELD_TRIP_LEVEL_TIMEOUT_MINUTES * 60 * 1000);
}

/**
 * Vencimiento del nivel siguiente al escalar: cada nivel dura 5 min contados desde el vencimiento del anterior
 * (no desde el momento en que el programador lo detecta), de modo que un retraso del proceso periódico no alarga
 * la cascada (BR-ADP-004: 3 niveles x 5 min exactos). Sin vencimiento previo se cuenta desde `now`.
 */
export function nextLevelTimeoutAfter(previousTimeoutAt: Date | null, now: Date): Date {
  return levelTimeoutFrom(previousTimeoutAt ?? now);
}

export const FIELD_TRIP_REJECTION_REASON_MIN_LENGTH = 5;

/** ADP-07: el rechazo de una salida exige un motivo escrito. */
export function assertFieldTripRejectionReason(reason: string | null | undefined): string {
  const trimmed = (reason ?? '').trim();
  if (trimmed.length < FIELD_TRIP_REJECTION_REASON_MIN_LENGTH) {
    throw new FieldTripRejectionReasonRequiredError();
  }
  return trimmed;
}

/** ADP-P03 / ADP-03: a partir de la 2ª falta injustificada del mes se genera un memo de advertencia. */
export const ABSENCE_MEMO_THRESHOLD = 2;

export const MEMO_KIND_FIELD_TRIP_LATE = 'RETORNO_TARDIO_CAMPO';
export const MEMO_KIND_REPEATED_ABSENCE = 'FALTA_INJUSTIFICADA_REITERADA';
export const MEMO_SOURCE_FIELD_TRIP = 'field_trip';
export const MEMO_SOURCE_ATTENDANCE = 'attendance';

const ORDINALS: Record<number, string> = { 1: '1ª', 2: '2ª', 3: '3ª', 4: '4ª' };
const ordinal = (n: number): string => ORDINALS[n] ?? `${n}ª`;

/** BR-ADP-005: desde la 4ª vez que no regresa a tiempo de una salida a campo se genera el memo (queda observado). */
export function shouldGenerateFieldTripMemo(newLateCount: number): boolean {
  return newLateCount >= FIELD_TRIP_OBSERVED_THRESHOLD;
}

export function buildFieldTripMemoReason(input: { newLateCount: number; lateMinutes: number; destination: string }): string {
  return `${ordinal(input.newLateCount)} vez que no regresa a tiempo de una salida a campo (${input.lateMinutes} min de retraso, destino: ${input.destination}). El colaborador queda observado.`;
}

export function shouldGenerateAbsenceMemo(unjustifiedInMonth: number): boolean {
  return unjustifiedInMonth >= ABSENCE_MEMO_THRESHOLD;
}

export function buildAbsenceMemoReason(input: { unjustifiedInMonth: number; date: string }): string {
  return `${ordinal(input.unjustifiedInMonth)} falta injustificada del mes (${input.date}). Se emite memo de advertencia por reiteración.`;
}

const FALTA_STATUSES = ['FALTA_JUSTIFICADA', 'FALTA_INJUSTIFICADA'] as const;
export const isAbsenceStatus = (status: string): boolean => (FALTA_STATUSES as readonly string[]).includes(status);

/**
 * ADP-03 / DAT-ADP-002: reclasificar una falta como JUSTIFICADA o INJUSTIFICADA.
 * - Solo se reclasifica una falta (justificada o injustificada) a la otra categoría.
 * - Si el descuento ya se liquidó a fin de mes no se puede modificar (BR-ADP-001).
 * - Justificada => sin descuento; injustificada => descuento proporcional calculado por el sistema (no se digita).
 * Exige una justificación escrita.
 */
export function resolveReclassification(input: {
  currentStatus: string;
  isDeductionApplied: boolean;
  targetStatus: string;
  justification?: string | null;
  baseSalary?: number | null;
}): { status: 'FALTA_JUSTIFICADA' | 'FALTA_INJUSTIFICADA'; deductionAmount: number; justification: string } {
  if (!isAbsenceStatus(input.currentStatus)) {
    throw new AttendanceNotReclassifiableError('Solo se pueden reclasificar las faltas (justificadas o injustificadas).');
  }
  if (input.isDeductionApplied) {
    throw new AttendanceNotReclassifiableError(
      'El descuento de esta falta ya se aplicó en el cierre de mes y no se puede modificar (BR-ADP-001).',
    );
  }
  if (!isAbsenceStatus(input.targetStatus)) {
    throw new InvalidAttendanceReclassificationError('La falta solo puede quedar como justificada o injustificada.');
  }
  if (input.targetStatus === input.currentStatus) {
    throw new InvalidAttendanceReclassificationError('La falta ya tiene esa clasificación.');
  }
  const justification = (input.justification ?? '').trim();
  if (justification.length < 5) {
    throw new InvalidAttendanceReclassificationError('Indica la justificación o el motivo del cambio (al menos 5 caracteres).');
  }
  const status = input.targetStatus as 'FALTA_JUSTIFICADA' | 'FALTA_INJUSTIFICADA';
  return {
    status,
    justification,
    deductionAmount:
      status === 'FALTA_INJUSTIFICADA' ? calculateAttendanceDeductionAmount(input.baseSalary, status, 0) : 0,
  };
}

/** Evidencia adjunta de permisos (ADP-04): tipos admitidos y tamaño máximo. */
export const LEAVE_EVIDENCE_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const;
export type LeaveEvidenceContentType = (typeof LEAVE_EVIDENCE_CONTENT_TYPES)[number];
export const MAX_LEAVE_EVIDENCE_BYTES = 10 * 1024 * 1024;
export const MAX_LEAVE_EVIDENCE_FILES = 5;

/** Duración de referencia de un taller interno informal (BR-ADP-008): ~1 hora, no bloqueante. */
export const TRAINING_REFERENCE_MINUTES = 60;

/**
 * BR-ADP-005: consecuencia de no regresar a tiempo de una salida a campo.
 * 1ª a 3ª vez: advertencia (cierre normal). 4ª vez en adelante: la persona queda "observada" (OBSERVADA).
 * `currentLateCount` es el contador de incumplimientos previos del colaborador.
 */
export function evaluateReturnOutcome(
  currentLateCount: number,
  scheduledReturn: Date,
  actualReturn: Date,
): {
  isLate: boolean;
  lateMinutes: number;
  newLateCount: number;
  status: 'CERRADA_NORMAL' | 'OBSERVADA';
  isObserved: boolean;
  message: string;
} {
  const diffMs = actualReturn.getTime() - scheduledReturn.getTime();
  const lateMinutes = Math.max(0, Math.floor(diffMs / (1000 * 60)));
  const isLate = lateMinutes > 0;

  if (!isLate) {
    return {
      isLate: false,
      lateMinutes: 0,
      newLateCount: currentLateCount,
      status: 'CERRADA_NORMAL',
      isObserved: currentLateCount >= FIELD_TRIP_OBSERVED_THRESHOLD,
      message: 'Retorno registrado a tiempo.',
    };
  }

  const newLateCount = currentLateCount + 1;
  if (newLateCount >= FIELD_TRIP_OBSERVED_THRESHOLD) {
    return {
      isLate: true,
      lateMinutes,
      newLateCount,
      status: 'OBSERVADA',
      isObserved: true,
      message: `Retorno con ${lateMinutes} min de retraso (${newLateCount}ª tardanza acumulada). Colaborador queda en estado OBSERVADO (BR-ADP-005).`,
    };
  }

  return {
    isLate: true,
    lateMinutes,
    newLateCount,
    status: 'CERRADA_NORMAL',
    isObserved: false,
    message: `Retorno con ${lateMinutes} min de retraso (${newLateCount}ª advertencia de 3 permitidas, BR-ADP-005).`,
  };
}

/**
 * BR-ADP-001: cálculo de deducción salarial por tardanzas o faltas injustificadas.
 * Se registra como pendiente y se aplica a fin de mes, nunca en la quincena.
 * Las faltas justificadas, permisos y asistencias no generan descuento.
 */
export function calculateAttendanceDeductionAmount(
  baseSalary: number | null | undefined,
  status: 'TARDANZA' | 'FALTA_INJUSTIFICADA' | string,
  minutesLate: number = 0,
): number {
  if (!baseSalary || baseSalary <= 0) return 0;

  const dailyRate = baseSalary / 30;
  const minuteRate = dailyRate / (8 * 60);

  if (status === 'FALTA_INJUSTIFICADA') {
    return Math.round(dailyRate * 100) / 100;
  }

  if (status === 'TARDANZA' && minutesLate > 0) {
    return Math.round(minuteRate * minutesLate * 100) / 100;
  }

  return 0;
}

export function isDeductibleAttendanceStatus(status: string): boolean {
  return status === 'TARDANZA' || status === 'FALTA_INJUSTIFICADA';
}

/**
 * DAT-ADP-002/003 + BR-ADP-001: normaliza un registro de asistencia.
 * - Solo TARDANZA lleva minutos de tardanza (y deben ser > 0).
 * - Solo TARDANZA y FALTA_INJUSTIFICADA pueden tener descuento; si Jefatura no indica un monto, se calcula
 *   proporcional al sueldo base. El descuento queda PENDIENTE hasta el cierre de mes.
 */
export function resolveAttendanceRecord(input: {
  status: string;
  minutesLate?: number | null;
  deductionAmount?: number | null;
  baseSalary?: number | null;
}): { minutesLate: number; deductionAmount: number } {
  if (input.status === 'TARDANZA') {
    if (!input.minutesLate || input.minutesLate <= 0) {
      throw new InvalidAttendanceRecordError('Una tardanza requiere indicar los minutos de tardanza (mayor a 0).');
    }
  }

  const minutesLate = input.status === 'TARDANZA' ? (input.minutesLate ?? 0) : 0;

  if (!isDeductibleAttendanceStatus(input.status)) {
    return { minutesLate, deductionAmount: 0 };
  }

  const deductionAmount =
    input.deductionAmount !== undefined && input.deductionAmount !== null
      ? Math.round(input.deductionAmount * 100) / 100
      : calculateAttendanceDeductionAmount(input.baseSalary, input.status, minutesLate);

  return { minutesLate, deductionAmount };
}

const PAYROLL_MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function parsePayrollMonth(month: string): { year: number; month: number } {
  const match = PAYROLL_MONTH_PATTERN.exec(month);
  if (!match) {
    throw new InvalidPayrollMonthError(month);
  }
  return { year: Number(match[1]), month: Number(match[2]) };
}

/**
 * BR-ADP-001 / SC-ADP-004.02: el descuento se aplica al cerrar el mes, no antes.
 * Se permite desde el último día calendario del mes (hora de Lima) en adelante.
 */
export function assertPayrollMonthClosable(month: string, now: Date): void {
  const { year, month: m } = parsePayrollMonth(month);
  const lastDay = new Date(Date.UTC(year, m, 0)).getUTCDate();
  const lastDayStart = Date.UTC(year, m - 1, lastDay);
  const limaNow = new Date(now.getTime() + LIMA_UTC_OFFSET_HOURS * 60 * 60 * 1000);
  const limaToday = Date.UTC(limaNow.getUTCFullYear(), limaNow.getUTCMonth(), limaNow.getUTCDate());
  if (limaToday < lastDayStart) {
    throw new DeductionsBeforeMonthEndError(month);
  }
}

/**
 * La edición de un colaborador no puede terminar la relación laboral (solo la operación de desvinculación, que
 * emite RelacionLaboralTerminada hacia Reclutamiento), ni reactivar a un colaborador terminado.
 */
export function assertEmployeeStatusEditable(from: string, to: string | undefined): void {
  if (to === undefined || to === from) return;
  if (from === 'TERMINADO' || to === 'TERMINADO') {
    throw new EmployeeStatusTransitionNotAllowedError(from, to);
  }
}

/**
 * BR-ADP-006: renuncia vs despido, con reglas distintas.
 * - RENUNCIA: se paga la quincena pendiente (finalSettlementPaid obligatorio) y el vínculo termina de inmediato;
 *   en la mayoría de los casos sin previo aviso (noticeDays 0).
 * - DESPIDO: se documenta el motivo (notas obligatorias); el aviso es de 0 o de 15 días si es reincidente.
 */
export function assertTerminationRules(input: {
  reason: string;
  noticeDays: number;
  finalSettlementPaid: boolean;
  notes?: string | null;
}): void {
  if (!Number.isInteger(input.noticeDays) || input.noticeDays < 0) {
    throw new InvalidTerminationNoticeError('Los días de aviso deben ser un entero mayor o igual a 0.');
  }

  if (input.reason === 'RENUNCIA') {
    if (!input.finalSettlementPaid) {
      throw new FinalSettlementRequiredError();
    }
    return;
  }

  if (input.reason === 'DESPIDO') {
    if (input.noticeDays !== 0 && input.noticeDays !== DISMISSAL_NOTICE_DAYS) {
      throw new InvalidTerminationNoticeError(
        `El aviso de un despido es de ${DISMISSAL_NOTICE_DAYS} días (reincidencia) o 0 (BR-ADP-006).`,
      );
    }
    if (!input.notes || input.notes.trim().length < 5) {
      throw new TerminationNotesRequiredError();
    }
  }
}

/** DEC-ADP-ATT-EVIDENCE-002: foto de asistencia subida por el propio colaborador (URL firmada GCS, patrón de Flota/permisos). */
export const ATTENDANCE_EVIDENCE_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type AttendanceEvidenceContentType = (typeof ATTENDANCE_EVIDENCE_CONTENT_TYPES)[number];
export const MAX_ATTENDANCE_EVIDENCE_BYTES = 12 * 1024 * 1024;

/**
 * La evidencia es obligatoria para marcaciones de presencia (la foto de reloj+hora+rostro corrobora que la persona
 * estuvo). Una falta no tiene foto posible: FALTA_* y PERMISO quedan exentas (suposición, ver decision-log).
 */
export const ATTENDANCE_STATUSES_REQUIRING_EVIDENCE: readonly string[] = ['PRESENTE', 'TARDANZA'];

export function attendanceEvidenceKeyPrefix(companyId: string, employeeId: string): string {
  return `companies/${companyId}/employees/${employeeId}/attendance/`;
}

/** Normaliza un correo para comparar/vincular: sin espacios y en minúsculas. */
export function normalizeEmail(email: string | null | undefined): string | null {
  const normalized = email?.trim().toLowerCase();
  return normalized ? normalized : null;
}
