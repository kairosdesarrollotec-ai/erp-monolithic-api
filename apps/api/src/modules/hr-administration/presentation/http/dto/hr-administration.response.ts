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
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeListResponse {
  items: EmployeeResponse[];
  total: number;
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
  createdAt: string;
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

export interface FieldTripResponse {
  id: string;
  employeeId: string;
  employeeName?: string;
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
  message: string | null;
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
}
