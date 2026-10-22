import type {
  AttendanceRecord,
  Employee,
  EmploymentTermination,
  FieldTripRequest,
  HrMemo,
  LeaveEvidence,
  LeaveRequest,
  VacationRequest,
} from '@prisma/client';
import type { TrainingWithAttendees } from '../../application/ports/training-repository.port';
import type { FieldTripWithEmployee } from '../../application/ports/field-trip-repository.port';
import type { EmployeeFieldVisibility } from '../../application/services/employee-field-visibility.service';
import type { BranchGeofenceRecord } from '../../application/ports/branch-geofence-repository.port';
import { isGeofenceConfigured } from '../../domain/attendance-self-service-rules';
import type { MonthlyAttendanceSummaryResult } from '../../application/queries/get-attendance-summary.handler';
import type { EmployeeDetailResult } from '../../application/queries/get-employee-detail.handler';
import type { ApplyMonthDeductionsResult } from '../../application/commands/apply-month-deductions.handler';
import type {
  ApplyDeductionsResponse,
  AttendanceRecordResponse,
  BranchGeofenceResponse,
  EmployeeDetailResponse,
  EmployeeResponse,
  EmploymentTerminationResponse,
  FieldTripResponse,
  HrMemoResponse,
  LeaveEvidenceResponse,
  LeaveRequestResponse,
  MonthlyAttendanceSummaryResponse,
  MyEmployeeResponse,
  TrainingResponse,
  VacationRequestResponse,
} from './dto/hr-administration.response';
import { toLimaLocalDateTimeString } from '../../../../common/time/lima-time';

const iso = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null);
const dateOnly = (d: Date): string => d.toISOString().slice(0, 10);

export function toEmployeeResponse(e: Employee, visibility: EmployeeFieldVisibility): EmployeeResponse {
  const restrictedFields: Array<'documentNumber' | 'baseSalary'> = [];
  if (!visibility.canViewDocument) restrictedFields.push('documentNumber');
  if (!visibility.canViewSalary) restrictedFields.push('baseSalary');
  return {
    id: e.id,
    companyId: e.operatingCompanyId,
    branchId: e.branchId,
    candidateId: e.candidateId,
    documentType: e.documentType,
    documentNumber: visibility.canViewDocument ? e.documentNumber : null,
    fullName: e.fullName,
    email: e.email,
    phone: e.phone,
    areaId: e.areaId,
    areaCode: e.areaId,
    areaName: e.areaName,
    jobTitle: e.jobTitle,
    status: e.status,
    hireDate: dateOnly(e.hireDate),
    probationEvaluatedAt: iso(e.probationEvaluatedAt),
    probationPassed: e.probationPassed,
    payrollStartedAt: iso(e.payrollStartedAt),
    terminatedAt: iso(e.terminatedAt),
    terminationReason: e.terminationReason,
    terminationNoticeDays: e.terminationNoticeDays,
    fieldTripLateCount: e.fieldTripLateCount,
    isFieldTripObserved: e.isFieldTripObserved,
    baseSalary:
      !visibility.canViewSalary || e.baseSalary === null || e.baseSalary === undefined ? null : Number(e.baseSalary),
    restrictedFields,
    accountLinked: !!e.firebaseUid,
    version: e.version,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  };
}

export function toMyEmployeeResponse(e: Employee): MyEmployeeResponse {
  return {
    id: e.id,
    companyId: e.operatingCompanyId,
    branchId: e.branchId,
    fullName: e.fullName,
    areaId: e.areaId,
    areaName: e.areaName,
    jobTitle: e.jobTitle,
    status: e.status,
    fieldTripLateCount: e.fieldTripLateCount,
    isFieldTripObserved: e.isFieldTripObserved,
  };
}

export function toHrMemoResponse(m: HrMemo, employeeName?: string): HrMemoResponse {
  return {
    id: m.id,
    employeeId: m.employeeId,
    ...(employeeName !== undefined ? { employeeName } : {}),
    kind: m.kind,
    violationNumber: m.violationNumber,
    reason: m.reason,
    issuedOn: dateOnly(m.issuedOn),
    generatedBy: m.generatedBy,
    createdAt: m.createdAt.toISOString(),
  };
}

export function toTrainingResponse(t: TrainingWithAttendees): TrainingResponse {
  return {
    id: t.id,
    topic: t.topic,
    heldOn: dateOnly(t.heldOn),
    durationMinutes: t.durationMinutes,
    comprehensionNotes: t.comprehensionNotes,
    attendees: t.attendees.map((a) => ({ employeeId: a.employeeId, fullName: a.employee.fullName })),
    createdAt: t.createdAt.toISOString(),
  };
}

export function toLeaveEvidenceResponse(e: LeaveEvidence): LeaveEvidenceResponse {
  return {
    id: e.id,
    leaveId: e.leaveId,
    objectUrl: e.objectUrl,
    contentType: e.contentType,
    uploadedById: e.uploadedById,
    createdAt: e.createdAt.toISOString(),
  };
}

export function toAttendanceRecordResponse(
  r: AttendanceRecord,
  employeeName?: string,
  memo?: HrMemo | null,
): AttendanceRecordResponse {
  return {
    id: r.id,
    employeeId: r.employeeId,
    ...(employeeName !== undefined ? { employeeName } : {}),
    latitude: r.latitude ?? null,
    longitude: r.longitude ?? null,
    accuracy: r.accuracy ?? null,
    date: dateOnly(r.date),
    checkInTime: iso(r.checkInTime),
    checkOutTime: iso(r.checkOutTime),
    status: r.status,
    minutesLate: r.minutesLate,
    deductionAmount: Number(r.deductionAmount),
    isDeductionApplied: r.isDeductionApplied,
    payrollMonth: r.payrollMonth,
    deductionAppliedAt: iso(r.deductionAppliedAt),
    notes: r.notes,
    justification: r.justification,
    reclassifiedAt: iso(r.reclassifiedAt),
    evidence:
      r.evidenceKind && r.evidenceCapturedAt
        ? {
            kind: r.evidenceKind,
            storageRef: r.evidenceStorageRef,
            url: r.evidenceUrl,
            capturedAtLocal: toLimaLocalDateTimeString(r.evidenceCapturedAt),
            note: r.evidenceNote,
            corroboratedBy: r.evidenceCorroboratedById,
            corroboratedAt: iso(r.evidenceCorroboratedAt),
          }
        : null,
    evidenceMissing: !r.evidenceKind,
    memo: memo ? toHrMemoResponse(memo) : null,
    source: r.source === 'SELF' ? 'SELF' : 'ON_BEHALF',
    onBehalfReason: r.onBehalfReason ?? null,
    capturedAt: iso(r.capturedAt),
    outsideGeofence: r.outsideGeofence,
    distanceMeters: r.distanceMeters ?? null,
    geofenceRadiusMeters: r.geofenceRadiusMeters ?? null,
    reviewStatus: (r.reviewStatus as AttendanceRecordResponse['reviewStatus']) ?? null,
    requiresReview: r.reviewStatus === 'PENDING',
    reviewedById: r.reviewedById ?? null,
    reviewedAt: iso(r.reviewedAt),
    reviewNote: r.reviewNote ?? null,
    checkOut: r.checkOutCapturedAt
      ? {
          capturedAt: iso(r.checkOutCapturedAt),
          latitude: r.checkOutLatitude ?? null,
          longitude: r.checkOutLongitude ?? null,
          accuracy: r.checkOutAccuracy ?? null,
          outsideGeofence: r.checkOutOutsideGeofence,
          distanceMeters: r.checkOutDistanceMeters ?? null,
        }
      : null,
    createdAt: r.createdAt.toISOString(),
  };
}

export function toBranchGeofenceResponse(g: BranchGeofenceRecord): BranchGeofenceResponse {
  return {
    branchId: g.branchId,
    branchName: g.branchName,
    configured: isGeofenceConfigured(g),
    latitude: g.latitude,
    longitude: g.longitude,
    radiusMeters: g.radiusMeters,
    updatedAt: iso(g.updatedAt),
    updatedBy: g.updatedBy,
  };
}

export function toMonthlyAttendanceSummaryResponse(
  result: MonthlyAttendanceSummaryResult,
): MonthlyAttendanceSummaryResponse {
  return {
    companyId: result.companyId,
    month: result.month,
    totalEmployees: result.totalEmployees,
    totalDeductionsAmount: result.totalDeductionsAmount,
    items: result.items.map((i) => ({
      employeeId: i.employeeId,
      employeeName: i.employeeName,
      areaName: i.areaName,
      totalLates: i.totalLates,
      totalUnjustified: i.totalUnjustified,
      calculatedDeduction: i.calculatedDeduction,
      isApplied: i.isApplied,
    })),
  };
}

export function toApplyDeductionsResponse(result: ApplyMonthDeductionsResult): ApplyDeductionsResponse {
  return {
    month: result.month,
    affectedEmployeesCount: result.affectedEmployeesCount,
    totalDeductionsApplied: result.totalDeductionsApplied,
  };
}

export function toLeaveRequestResponse(l: LeaveRequest, employeeName?: string): LeaveRequestResponse {
  return {
    id: l.id,
    employeeId: l.employeeId,
    ...(employeeName !== undefined ? { employeeName } : {}),
    type: l.type,
    date: dateOnly(l.date),
    startTime: iso(l.startTime),
    endTime: iso(l.endTime),
    reason: l.reason,
    status: l.status,
    authorizedById: l.authorizedById,
    authorizedByName: l.authorizedByName,
    resolutionNotes: l.resolutionNotes,
    resolvedAt: iso(l.resolvedAt),
    createdAt: l.createdAt.toISOString(),
  };
}

export function toVacationRequestResponse(
  v: VacationRequest,
  names?: { employeeName?: string; areaName?: string },
): VacationRequestResponse {
  return {
    id: v.id,
    employeeId: v.employeeId,
    ...(names?.employeeName !== undefined ? { employeeName: names.employeeName } : {}),
    areaId: v.areaId,
    ...(names?.areaName !== undefined ? { areaName: names.areaName } : {}),
    startDate: dateOnly(v.startDate),
    endDate: dateOnly(v.endDate),
    status: v.status,
    requestedAt: v.requestedAt.toISOString(),
    approvedById: v.approvedById,
    approvedAt: iso(v.approvedAt),
    notes: v.notes,
    originalStartDate: v.originalStartDate ? dateOnly(v.originalStartDate) : null,
    originalEndDate: v.originalEndDate ? dateOnly(v.originalEndDate) : null,
    rescheduleCount: v.rescheduleCount,
    statusReason: v.statusReason,
    statusChangedAt: iso(v.statusChangedAt),
    statusChangedById: v.statusChangedById,
    createdAt: v.createdAt.toISOString(),
  };
}

export function toFieldTripResponse(
  f: FieldTripRequest | FieldTripWithEmployee,
  options?: { employeeName?: string; message?: string | null; memo?: HrMemo | null },
): FieldTripResponse {
  const employee = 'employee' in f ? f.employee : undefined;
  return {
    id: f.id,
    employeeId: f.employeeId,
    ...(options?.employeeName !== undefined ? { employeeName: options.employeeName } : {}),
    ...(employee
      ? {
          employee: {
            id: employee.id,
            fullName: employee.fullName,
            areaName: employee.areaName,
            jobTitle: employee.jobTitle,
            fieldTripLateCount: employee.fieldTripLateCount,
            isFieldTripObserved: employee.isFieldTripObserved,
          },
        }
      : {}),
    destination: f.destination,
    objective: f.objective,
    estimatedDeparture: f.estimatedDeparture.toISOString(),
    estimatedReturn: f.estimatedReturn.toISOString(),
    actualDeparture: iso(f.actualDeparture),
    actualReturn: iso(f.actualReturn),
    status: f.status,
    authorizationLevel: f.authorizationLevel,
    authorizedById: f.authorizedById,
    authorizedByName: f.authorizedByName,
    authorizedAt: iso(f.authorizedAt),
    level1TimeoutAt: iso(f.level1TimeoutAt),
    level2TimeoutAt: iso(f.level2TimeoutAt),
    level3TimeoutAt: iso(f.level3TimeoutAt),
    lateMinutes: f.lateMinutes,
    returnNotes: f.returnNotes,
    rejectedById: f.rejectedById,
    rejectedByName: f.rejectedByName,
    rejectedAt: iso(f.rejectedAt),
    rejectedAtLevel: f.rejectedAtLevel,
    rejectionReason: f.rejectionReason,
    message: options?.message ?? null,
    memo: options?.memo ? toHrMemoResponse(options.memo) : null,
    createdAt: f.createdAt.toISOString(),
  };
}

export function toEmploymentTerminationResponse(
  t: EmploymentTermination,
  employeeName?: string,
  vacancyCreatedId: string | null = null,
): EmploymentTerminationResponse {
  return {
    id: t.id,
    employeeId: t.employeeId,
    ...(employeeName !== undefined ? { employeeName } : {}),
    reason: t.reason,
    noticeDays: t.noticeDays,
    finalSettlementPaid: t.finalSettlementPaid,
    settlementAmount: Number(t.settlementAmount),
    notes: t.notes,
    terminatedById: t.terminatedById,
    terminatedAt: t.terminatedAt.toISOString(),
    createdAt: t.createdAt.toISOString(),
    // La vacante la crea Reclutamiento de forma asincrona al consumir RelacionLaboralTerminada.v1 (ADR-KAI-006, 22-oct #5): en la
    // respuesta inmediata de `terminate` es null; el expediente (GET /employees/{id}) la informa cuando el evento ya se consumio.
    vacancyCreatedId,
  };
}

export function toEmployeeDetailResponse(
  detail: EmployeeDetailResult,
  visibility: EmployeeFieldVisibility,
): EmployeeDetailResponse {
  const name = detail.employee.fullName;
  return {
    ...toEmployeeResponse(detail.employee, visibility),
    attendanceSummary: detail.attendanceSummary,
    recentLeaves: detail.recentLeaves.map((l) => toLeaveRequestResponse(l, name)),
    recentVacations: detail.recentVacations.map((v) =>
      toVacationRequestResponse(v, { employeeName: name, areaName: detail.employee.areaName }),
    ),
    recentFieldTrips: detail.recentFieldTrips.map((f) => toFieldTripResponse(f, { employeeName: f.employee.fullName })),
    termination: detail.termination
      ? toEmploymentTerminationResponse(detail.termination, name, detail.terminationVacancyCreatedId)
      : null,
    recentMemos: detail.recentMemos.map((m) => toHrMemoResponse(m, name)),
    recentTrainings: detail.recentTrainings.map(toTrainingResponse),
  };
}
