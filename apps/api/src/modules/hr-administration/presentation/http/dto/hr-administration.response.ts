import type {
  AttendanceStatus,
  EmployeeStatus,
  FieldTripStatus,
  LeaveStatus,
  LeaveType,
  TerminationReason,
  VacationStatus,
} from '@prisma/client';

export interface EmployeeResponse {
  id: string;
  companyId: string;
  branchId: string;
  candidateId: string | null;
  documentType: string;
  documentNumber: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  areaId: string;
  areaName: string;
  jobTitle: string;
  status: EmployeeStatus;
  hireDate: string;
  probationEvaluatedAt: string | null;
  probationPassed: boolean | null;
  payrollStartedAt: string | null;
  terminatedAt: string | null;
  terminationReason: TerminationReason | null;
  terminationNoticeDays: number | null;
  fieldTripLateCount: number;
  isFieldTripObserved: boolean;
  baseSalary: number | null;
  /** DEC-ADP-LINK-EMAIL-001: la ficha está vinculada a una cuenta de usuario (por correo). */
  accountLinked: boolean;
  /** DEC-ADP-EDIT-ETAG-001: versión optimista; viaja también en el header ETag y se devuelve en If-Match. */
  version: number;
  createdAt: string;
  updatedAt: string;
}

/** DEC-ADP-RELINK-001: aviso de re-vinculación que acompaña a la respuesta de PATCH /employees/{id}. */
export interface AccountRelinkNotice {
  action: 'RELINKED' | 'UNLINKED';
  reason: 'EMAIL_CHANGED';
  previousEmail: string | null;
  newEmail: string | null;
}

export interface UpdateEmployeeResponse extends EmployeeResponse {
  /** Solo presente si la edición cambió el vínculo con la cuenta de acceso. */
  accountRelink?: AccountRelinkNotice;
}

/** H-02: area del catalogo de RR.HH. de la empresa. `Employee.areaId` es el `code` cuando el area viene del catalogo. */
export interface HrAreaResponse {
  code: string;
  name: string;
  description: string | null;
  sortOrder: number;
}

export interface HrAreaListResponse {
  items: HrAreaResponse[];
}

export interface EmployeeListResponse {
  items: EmployeeResponse[];
  total: number;
}

export interface AttendanceEvidenceResponse {
  kind: string;
  storageRef: string | null;
  url: string | null;
  /** Hora de la foto en America/Lima, sin offset (YYYY-MM-DDTHH:mm:ss). */
  capturedAtLocal: string;
  note: string | null;
  /** Usuario (Firebase UID) que corroboro la foto y registro la marcacion. */
  corroboratedBy: string | null;
  corroboratedAt: string | null;
}

export interface AttendanceRecordResponse {
  id: string;
  employeeId: string;
  employeeName?: string;
  date: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  status: AttendanceStatus;
  minutesLate: number;
  deductionAmount: number;
  isDeductionApplied: boolean;
  payrollMonth: string | null;
  deductionAppliedAt: string | null;
  notes: string | null;
  justification: string | null;
  reclassifiedAt: string | null;
  /** DEC-ADP-ATT-EVIDENCE-001: foto de respaldo (reloj+hora+rostro, grupo de WhatsApp); null si no se adjunto. */
  evidence: AttendanceEvidenceResponse | null;
  /** true cuando el registro no tiene evidencia fotografica (incluye registros previos a la migracion). */
  evidenceMissing: boolean;
  /** Memo de advertencia generado automáticamente por esta operación (reiteración de faltas), si corresponde. */
  memo: HrMemoResponse | null;
  createdAt: string;
}

export interface HrMemoResponse {
  id: string;
  employeeId: string;
  employeeName?: string;
  kind: string;
  violationNumber: number;
  reason: string;
  issuedOn: string;
  generatedBy: string;
  createdAt: string;
}

export interface TrainingResponse {
  id: string;
  topic: string;
  heldOn: string;
  durationMinutes: number;
  comprehensionNotes: string | null;
  attendees: Array<{ employeeId: string; fullName: string }>;
  createdAt: string;
}

export interface LeaveEvidenceResponse {
  id: string;
  leaveId: string;
  objectUrl: string;
  contentType: string;
  uploadedById: string;
  createdAt: string;
}

export interface AttendanceEvidenceUploadSessionResponse {
  uploadUrl: string;
  objectUrl: string;
  /** Clave del objeto: es el valor que va en `evidence.storageRef` de log-attendance. */
  storageRef: string;
  expiresAt: string;
}

export interface LeaveEvidenceUploadSessionResponse {
  uploadUrl: string;
  objectUrl: string;
  expiresAt: string;
}

export interface MyEmployeeResponse {
  id: string;
  companyId: string;
  branchId: string;
  fullName: string;
  areaId: string;
  areaName: string;
  jobTitle: string;
  status: EmployeeStatus;
  fieldTripLateCount: number;
  isFieldTripObserved: boolean;
}

export interface MonthlyAttendanceSummaryResponse {
  companyId: string;
  month: string;
  totalEmployees: number;
  totalDeductionsAmount: number;
  items: Array<{
    employeeId: string;
    employeeName: string;
    areaName: string;
    totalLates: number;
    totalUnjustified: number;
    calculatedDeduction: number;
    isApplied: boolean;
  }>;
}

export interface ApplyDeductionsResponse {
  month: string;
  affectedEmployeesCount: number;
  totalDeductionsApplied: number;
}

export interface LeaveRequestResponse {
  id: string;
  employeeId: string;
  employeeName?: string;
  type: LeaveType;
  date: string;
  startTime: string | null;
  endTime: string | null;
  reason: string;
  status: LeaveStatus;
  authorizedById: string | null;
  authorizedByName: string | null;
  resolutionNotes: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

export interface VacationRequestResponse {
  id: string;
  employeeId: string;
  employeeName?: string;
  areaId: string;
  areaName?: string;
  startDate: string;
  endDate: string;
  status: VacationStatus;
  requestedAt: string;
  approvedById: string | null;
  approvedAt: string | null;
  notes: string | null;
  createdAt: string;
}

export interface FieldTripEmployeeSummary {
  id: string;
  fullName: string;
  areaName: string;
  jobTitle: string;
  fieldTripLateCount: number;
  isFieldTripObserved: boolean;
}

export interface FieldTripResponse {
  id: string;
  employeeId: string;
  employeeName?: string;
  /** Datos mínimos del colaborador que se evalúa (no exige permiso de consulta de expedientes). */
  employee?: FieldTripEmployeeSummary;
  destination: string;
  objective: string;
  estimatedDeparture: string;
  estimatedReturn: string;
  actualDeparture: string | null;
  actualReturn: string | null;
  status: FieldTripStatus;
  authorizationLevel: number | null;
  authorizedById: string | null;
  authorizedByName: string | null;
  authorizedAt: string | null;
  level1TimeoutAt: string | null;
  level2TimeoutAt: string | null;
  level3TimeoutAt: string | null;
  lateMinutes: number;
  returnNotes: string | null;
  rejectedById: string | null;
  rejectedByName: string | null;
  rejectedAt: string | null;
  rejectedAtLevel: number | null;
  rejectionReason: string | null;
  message: string | null;
  /** Memo de advertencia generado automáticamente al registrar el retorno (4ª tardanza en adelante), si corresponde. */
  memo: HrMemoResponse | null;
  createdAt: string;
}

export interface EmploymentTerminationResponse {
  id: string;
  employeeId: string;
  employeeName?: string;
  reason: TerminationReason;
  noticeDays: number;
  finalSettlementPaid: boolean;
  settlementAmount: number;
  notes: string | null;
  terminatedById: string;
  terminatedAt: string;
  createdAt: string;
  vacancyCreatedId: string | null;
}

export interface EmployeeDetailResponse extends EmployeeResponse {
  attendanceSummary: {
    totalPresent: number;
    totalLate: number;
    totalJustifiedAbsences: number;
    totalUnjustifiedAbsences: number;
    pendingDeductionAmount: number;
  };
  recentLeaves: LeaveRequestResponse[];
  recentVacations: VacationRequestResponse[];
  recentFieldTrips: FieldTripResponse[];
  termination: EmploymentTerminationResponse | null;
  recentMemos: HrMemoResponse[];
  recentTrainings: TrainingResponse[];
}
