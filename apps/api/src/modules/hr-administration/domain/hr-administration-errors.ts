import {
  DomainBadRequestError,
  DomainConflictError,
  DomainForbiddenError,
  DomainNotFoundError,
  DomainPreconditionError,
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

export class VacationNotFoundError extends DomainNotFoundError {
  readonly code = 'VACATION_NOT_FOUND';

  constructor(id: string) {
    super(`No se encontró la solicitud de vacaciones con ID ${id}.`);
  }
}

/** Reprogramar/cancelar solo aplica a vacaciones SOLICITADA / PROGRAMADA / REPROGRAMADA (las CANCELADA o COMPLETADA ya no se tocan). */
export class VacationNotModifiableError extends DomainConflictError {
  readonly code = 'VACATION_NOT_MODIFIABLE';

  constructor(id: string, status: string) {
    super(`Las vacaciones ${id} están en estado ${status} y ya no se pueden reprogramar ni cancelar.`);
  }
}

export class VacationChangeReasonRequiredError extends DomainUnprocessableError {
  readonly code = 'VACATION_CHANGE_REASON_REQUIRED';

  constructor() {
    super('Indica el motivo (entre 3 y 500 caracteres) para reprogramar o cancelar las vacaciones.');
  }
}

export class VacationRescheduleUnchangedError extends DomainUnprocessableError {
  readonly code = 'VACATION_RESCHEDULE_UNCHANGED';

  constructor() {
    super('Las nuevas fechas son iguales a las actuales: elige otras fechas libres para reprogramar.');
  }
}

export class VacationDateInPastError extends DomainUnprocessableError {
  readonly code = 'VACATION_DATE_IN_PAST';

  constructor() {
    super('Las nuevas fechas de vacaciones no pueden empezar antes de hoy.');
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

export class AttendanceEvidenceRequiredError extends DomainUnprocessableError {
  readonly code = 'ATTENDANCE_EVIDENCE_REQUIRED';

  constructor() {
    super(
      'La asistencia requiere la foto de evidencia (reloj + hora + rostro). Súbela con la URL firmada y envía evidence con su storageRef.',
    );
  }
}

export class EmployeeEmailRequiredError extends DomainUnprocessableError {
  readonly code = 'EMPLOYEE_EMAIL_REQUIRED';

  constructor() {
    super('El colaborador no tiene correo registrado: el vínculo con su cuenta de usuario se hace por correo.');
  }
}

export class UserAccountNotFoundError extends DomainNotFoundError {
  readonly code = 'USER_ACCOUNT_NOT_FOUND';

  constructor(email: string) {
    super(`No existe una cuenta de usuario con el correo ${email}.`);
  }
}

/** DEC-ADP-EDIT-ETAG-001: la ficha cambió desde que el cliente la leyó (If-Match no coincide) - 412 EMPLOYEE_VERSION_CONFLICT. */
export class EmployeeVersionConflictError extends DomainPreconditionError {
  readonly code = 'EMPLOYEE_VERSION_CONFLICT';

  constructor(currentVersion?: number) {
    super(
      currentVersion === undefined
        ? 'La ficha fue modificada por otra persona; vuelve a cargarla antes de guardar.'
        : `La ficha fue modificada por otra persona (versión actual ${currentVersion}); vuelve a cargarla antes de guardar.`,
    );
  }
}

export class EmployeeAccountAlreadyLinkedError extends DomainConflictError {
  readonly code = 'EMPLOYEE_ACCOUNT_ALREADY_LINKED';

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

export class AttendanceEvidenceStorageUnavailableError extends DomainServiceUnavailableError {
  readonly code = 'ATTENDANCE_EVIDENCE_STORAGE_UNAVAILABLE';

  constructor() {
    super('Almacenamiento de evidencia de asistencia no configurado (variables de entorno GCS faltantes).');
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

/** H-02 / DEC-ADP-AREAS-001: el `areaCode` enviado no existe (o esta inactivo) en el catalogo de areas de la empresa. */
export class HrAreaNotFoundError extends DomainUnprocessableError {
  readonly code = 'HR_AREA_NOT_FOUND';

  constructor(areaCode: string) {
    super(`El área "${areaCode}" no existe en el catálogo de áreas de esta empresa.`);
  }
}

/** H-02: falta el area (ni `areaCode` ni `areaName`). */
export class HrAreaRequiredError extends DomainBadRequestError {
  readonly code = 'AREA_REQUIRED';

  constructor() {
    super('Indica el área: elige una del catálogo (areaCode) o escribe el nombre (areaName).');
  }
}

/** Respuestas 2026-10-20 #17: ya existe un area (activa o no) con ese codigo, nombre o alias en la empresa. */
export class HrAreaAlreadyExistsError extends DomainConflictError {
  readonly code = 'HR_AREA_ALREADY_EXISTS';

  constructor(name: string) {
    super(`Ya existe un área "${name}" (o equivalente) en el catálogo de esta empresa.`);
  }
}

/** No se puede desactivar un area con colaboradores activos asignados. */
export class HrAreaInUseError extends DomainConflictError {
  readonly code = 'HR_AREA_IN_USE';

  constructor(name: string, count: number) {
    super(`El área "${name}" tiene ${count} colaborador(es) activo(s); reasígnalos antes de desactivarla.`);
  }
}

/** El nombre del area no produce un codigo valido (vacio o solo simbolos). */
export class HrAreaNameInvalidError extends DomainUnprocessableError {
  readonly code = 'HR_AREA_NAME_INVALID';

  constructor() {
    super('El nombre del área debe contener letras o números.');
  }
}

/** El sueldo base de la ficha solo lo edita Gerencia (permiso HR_ADMINISTRATION.MANAGE_SALARY). */
export class EmployeeSalaryGerenciaOnlyError extends DomainForbiddenError {
  readonly code = 'EMPLOYEE_SALARY_GERENCIA_ONLY';

  constructor() {
    super('El sueldo base solo puede editarlo Gerencia General; el resto de la ficha puede editarse sin cambiar el sueldo.');
  }
}

// ---- 22-oct (Respuestas #9): autoservicio de asistencia, geocerca y revision ----

export class AttendanceLocationRequiredError extends DomainUnprocessableError {
  readonly code = 'ATTENDANCE_LOCATION_REQUIRED';

  constructor() {
    super('La marca de asistencia propia requiere la ubicación (latitude, longitude y accuracy).');
  }
}

export class AttendanceCaptureTooOldError extends DomainUnprocessableError {
  readonly code = 'ATTENDANCE_CAPTURE_TOO_OLD';

  constructor(maxHours: number) {
    super(`La hora de la marca (capturedAt) tiene más de ${maxHours} horas de antigüedad y ya no se acepta.`);
  }
}

export class AttendanceReasonRequiredError extends DomainUnprocessableError {
  readonly code = 'ATTENDANCE_REASON_REQUIRED';

  constructor() {
    super(
      'Registrar la presencia o tardanza a nombre de otro colaborador requiere el motivo (reason, 3 a 500 caracteres).',
    );
  }
}

export class AttendanceSelfStatusNotAllowedError extends DomainUnprocessableError {
  readonly code = 'ATTENDANCE_SELF_STATUS_NOT_ALLOWED';

  constructor(status: string) {
    super(`El estado ${status} no se puede marcar desde la cuenta personal; solo PRESENTE o TARDANZA.`);
  }
}

export class AttendanceCheckInRequiredError extends DomainConflictError {
  readonly code = 'ATTENDANCE_CHECK_IN_REQUIRED';

  constructor() {
    super('Para marcar la salida primero debe existir la entrada del día.');
  }
}

export class AttendanceMarkAlreadyLoggedError extends DomainConflictError {
  readonly code = 'ATTENDANCE_MARK_ALREADY_LOGGED';

  constructor(type: string) {
    super(`Ya existe la marca de ${type === 'CHECK_OUT' ? 'salida' : 'entrada'} de este día.`);
  }
}

export class AttendanceNotPendingReviewError extends DomainConflictError {
  readonly code = 'ATTENDANCE_NOT_PENDING_REVIEW';

  constructor() {
    super('La marca no está pendiente de revisión.');
  }
}

export class InvalidAttendanceReviewError extends DomainUnprocessableError {
  readonly code = 'INVALID_ATTENDANCE_REVIEW';

  constructor(detail: string) {
    super(detail);
  }
}

export class InvalidGeofenceError extends DomainUnprocessableError {
  readonly code = 'INVALID_GEOFENCE';

  constructor(detail: string) {
    super(detail);
  }
}

export class BranchNotFoundError extends DomainNotFoundError {
  readonly code = 'BRANCH_NOT_FOUND';

  constructor(branchId: string) {
    super(`No se encontró la sede ${branchId} en la empresa indicada.`);
  }
}
