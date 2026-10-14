import {
  DomainBadRequestError,
  DomainConflictError,
  DomainNotFoundError,
  DomainServiceUnavailableError,
  DomainUnprocessableError,
} from '../../../common/domain/domain-errors';

export class EmployeeNotFoundError extends DomainNotFoundError {
  readonly code = 'EMPLOYEE_NOT_FOUND';

  constructor(id?: string) {
    super(id ? `No se encontró el colaborador con ID ${id}.` : 'Colaborador no encontrado.');
  }
}

export class DuplicateEmployeeDocumentError extends DomainConflictError {
  readonly code = 'DUPLICATE_EMPLOYEE_DOCUMENT';

  constructor(documentNumber: string) {
    super(`Ya existe un colaborador registrado con el documento ${documentNumber} en esta empresa.`);
  }
}

export class EmployeeTerminatedError extends DomainConflictError {
  readonly code = 'EMPLOYEE_TERMINATED';

  constructor(employeeId: string) {
    super(`El colaborador ${employeeId} tiene la relación laboral terminada y no admite nuevas operaciones.`);
  }
}

export class EmployeeStatusTransitionNotAllowedError extends DomainUnprocessableError {
  readonly code = 'EMPLOYEE_STATUS_TRANSITION_NOT_ALLOWED';

  constructor(from: string, to: string) {
    super(
      `No es posible cambiar el estado del colaborador de ${from} a ${to} por edición. El término de la relación laboral solo se registra con la operación de desvinculación (BR-ADP-006, BR-REC-008).`,
    );
  }
}

export class EmploymentAlreadyTerminatedError extends DomainConflictError {
  readonly code = 'EMPLOYMENT_ALREADY_TERMINATED';

  constructor(employeeId: string) {
    super(`El colaborador ${employeeId} ya cuenta con un cese o desvinculación laboral registrada.`);
  }
}

export class InvalidTerminationNoticeError extends DomainUnprocessableError {
  readonly code = 'INVALID_TERMINATION_NOTICE';

  constructor(detail: string) {
    super(detail);
  }
}

export class TerminationNotesRequiredError extends DomainUnprocessableError {
  readonly code = 'TERMINATION_NOTES_REQUIRED';

  constructor() {
    super('El despido requiere documentar el motivo en las notas (BR-ADP-006).');
  }
}

export class FinalSettlementRequiredError extends DomainUnprocessableError {
  readonly code = 'FINAL_SETTLEMENT_REQUIRED';

  constructor() {
    super('En una renuncia se debe pagar la quincena pendiente antes de cerrar la relación laboral (BR-ADP-006, EX-ADP-003).');
  }
}

export class VacationOverlapError extends DomainConflictError {
  readonly code = 'VACATION_OVERLAP';

  constructor(areaName: string, detail?: string) {
    super(
      detail ||
        `Conflicto de superposición de vacaciones en el área ${areaName}: la capacidad máxima es de 1 persona a la vez (BR-ADP-002, DR-ADP-001).`,
    );
  }
}

export class InvalidDateRangeError extends DomainBadRequestError {
  readonly code = 'INVALID_DATE_RANGE';

  constructor() {
    super('La fecha de inicio debe ser anterior o igual a la fecha de término.');
  }
}

export class LeaveNotFoundError extends DomainNotFoundError {
  readonly code = 'LEAVE_NOT_FOUND';

  constructor(id: string) {
    super(`No se encontró la solicitud de permiso con ID ${id}.`);
  }
}

export class LeaveAlreadyResolvedError extends DomainConflictError {
  readonly code = 'LEAVE_ALREADY_RESOLVED';

  constructor(id: string) {
    super(`La solicitud de permiso ${id} ya fue resuelta previamente.`);
  }
}

export class InvalidLeaveResolutionError extends DomainBadRequestError {
  readonly code = 'INVALID_LEAVE_STATUS';

  constructor() {
    super('Un permiso solo puede resolverse como AUTORIZADO o DENEGADO.');
  }
}

export class FieldTripNotFoundError extends DomainNotFoundError {
  readonly code = 'FIELD_TRIP_NOT_FOUND';

  constructor(id: string) {
    super(`No se encontró la solicitud de salida a campo con ID ${id}.`);
  }
}

export class FieldTripNotPendingError extends DomainConflictError {
  readonly code = 'FIELD_TRIP_NOT_PENDING';

  constructor(id: string, currentStatus: string) {
    super(`La salida a campo ${id} no está en estado pendiente de autorización (estado actual: ${currentStatus}).`);
  }
}

export class FieldTripNotAuthorizedError extends DomainConflictError {
  readonly code = 'FIELD_TRIP_NOT_AUTHORIZED';

  constructor(id: string, currentStatus: string) {
    super(
      `La salida a campo ${id} debe estar en estado AUTORIZADA para evaluar su retorno (estado actual: ${currentStatus}).`,
    );
  }
}

export class FieldTripTimeoutNotElapsedError extends DomainConflictError {
  readonly code = 'FIELD_TRIP_TIMEOUT_NOT_ELAPSED';

  constructor(id: string, timeoutAt: Date) {
    super(
      `El temporizador de 5 minutos del nivel actual de la salida a campo ${id} aún no vence (vence ${timeoutAt.toISOString()}). No se puede escalar antes (BR-ADP-004).`,
    );
  }
}

export class InvalidFieldTripDatesError extends DomainBadRequestError {
  readonly code = 'INVALID_FIELD_TRIP_DATES';

  constructor() {
    super('La hora estimada de salida debe ser anterior a la hora estimada de retorno.');
  }
}

export class InvalidAuthorizationLevelError extends DomainBadRequestError {
  readonly code = 'INVALID_AUTHORIZATION_LEVEL';

  constructor(level: number) {
    super(
      `Nivel de autorización inválido (${level}). Solo se admiten niveles 1, 2 y 3. No existe 4to nivel automatizado (BR-ADP-004).`,
    );
  }
}

export class AuthorizationLevelNotReachedError extends DomainBadRequestError {
  readonly code = 'AUTHORIZATION_LEVEL_NOT_REACHED';

  constructor(requested: number, current: number) {
    super(
      `La cascada aún no llegó al nivel ${requested}: el nivel pendiente actual es ${current}. No se puede saltar niveles (BR-ADP-004).`,
    );
  }
}

export class NoAuthorizationAvailableError extends DomainConflictError {
  readonly code = 'NO_AUTHORIZATION_AVAILABLE';

  constructor(id: string) {
    super(
      `Nadie autorizó la salida a campo ${id} tras agotarse los 3 niveles de la cascada. La persona no sale y la decisión posterior queda manual, fuera del sistema (BR-ADP-004, DR-ADP-002).`,
    );
  }
}

export class AttendanceAlreadyLoggedError extends DomainConflictError {
  readonly code = 'ATTENDANCE_ALREADY_LOGGED';

  constructor(employeeId: string, date: string) {
    super(`Ya existe registro de asistencia para el colaborador ${employeeId} en la fecha ${date}.`);
  }
}

export class InvalidAttendanceRecordError extends DomainUnprocessableError {
  readonly code = 'INVALID_ATTENDANCE_RECORD';

  constructor(detail: string) {
    super(detail);
  }
}

/** DEC-ADP-ATT-EVIDENCE-001: evidencia fotografica de asistencia mal formada (422). */
export class InvalidAttendanceEvidenceError extends DomainUnprocessableError {
  readonly code = 'INVALID_ATTENDANCE_EVIDENCE';

  constructor(detail: string) {
    super(detail);
  }
}

export class InvalidPayrollMonthError extends DomainBadRequestError {
  readonly code = 'INVALID_PAYROLL_MONTH';

  constructor(month: string) {
    super(`El mes de liquidación "${month}" no es válido; use el formato YYYY-MM.`);
  }
}

export class DeductionsBeforeMonthEndError extends DomainUnprocessableError {
  readonly code = 'DEDUCTIONS_BEFORE_MONTH_END';

  constructor(month: string) {
    super(
      `Los descuentos por faltas y tardanzas solo se aplican a fin de mes, nunca en la quincena (BR-ADP-001). El mes ${month} todavía no cierra.`,
    );
  }
}

export class CandidateAlreadyEmployeeError extends DomainConflictError {
  readonly code = 'CANDIDATE_ALREADY_EMPLOYEE';

  constructor() {
    super('El candidato indicado ya fue registrado como colaborador.');
  }
}

export class FieldTripRejectionReasonRequiredError extends DomainUnprocessableError {
  readonly code = 'FIELD_TRIP_REJECTION_REASON_REQUIRED';

  constructor() {
    super('Para rechazar una salida a campo indica el motivo del rechazo (al menos 5 caracteres).');
  }
}

export class EmployeeNotLinkedError extends DomainNotFoundError {
  readonly code = 'EMPLOYEE_NOT_LINKED';

  constructor() {
    super('Tu usuario todavía no está vinculado a una ficha de colaborador en esta empresa. Pide a Personal que registre tu correo de acceso en tu ficha.');
  }
}

export class AttendanceRecordNotFoundError extends DomainNotFoundError {
  readonly code = 'ATTENDANCE_NOT_FOUND';

  constructor(id: string) {
    super(`No se encontró el registro de asistencia con ID ${id}.`);
  }
}

export class AttendanceNotReclassifiableError extends DomainConflictError {
  readonly code = 'ATTENDANCE_NOT_RECLASSIFIABLE';

  constructor(detail: string) {
    super(detail);
  }
}

export class InvalidAttendanceReclassificationError extends DomainUnprocessableError {
  readonly code = 'INVALID_ATTENDANCE_RECLASSIFICATION';

  constructor(detail: string) {
    super(detail);
  }
}

export class LeaveEvidenceNotAllowedError extends DomainConflictError {
  readonly code = 'LEAVE_EVIDENCE_NOT_ALLOWED';

  constructor(id: string, status: string) {
    super(`Solo se puede adjuntar evidencia a un permiso pendiente de resolución (el permiso ${id} está ${status}).`);
  }
}

export class InvalidLeaveEvidenceError extends DomainBadRequestError {
  readonly code = 'INVALID_LEAVE_EVIDENCE';

  constructor(detail: string) {
    super(detail);
  }
}

export class LeaveEvidenceStorageUnavailableError extends DomainServiceUnavailableError {
  readonly code = 'EVIDENCE_STORAGE_UNAVAILABLE';

  constructor() {
    super('Almacenamiento de evidencia no configurado (variables de entorno GCS faltantes).');
  }
}

export class TrainingAttendeesInvalidError extends DomainUnprocessableError {
  readonly code = 'TRAINING_ATTENDEES_INVALID';

  constructor(detail: string) {
    super(detail);
  }
}

export class InvalidTrainingError extends DomainUnprocessableError {
  readonly code = 'INVALID_TRAINING';

  constructor(detail: string) {
    super(detail);
  }
}
