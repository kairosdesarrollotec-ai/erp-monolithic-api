import type { AttendanceRecord, AttendanceStatus, Prisma } from '@prisma/client';

export interface CreateAttendanceData {
  employeeId: string;
  date: Date;
  checkInTime?: Date | null;
  checkOutTime?: Date | null;
  status: AttendanceStatus;
  minutesLate?: number;
  deductionAmount?: number;
  notes?: string | null;
  createdById: string;
  /** DEC-ADP-ATT-EVIDENCE-001 */
  evidence?: {
    kind: string;
    storageRef: string | null;
    url: string | null;
    capturedAt: Date;
    note: string | null;
    corroboratedById: string;
    corroboratedAt: Date;
  } | null;
}

export interface ReclassifyAttendanceData {
  status: AttendanceStatus;
  deductionAmount: number;
  justification: string;
  reclassifiedById: string;
  reclassifiedAt: Date;
}

export interface AttendanceWithEmployee extends AttendanceRecord {
  employee: {
    fullName: string;
    organizationId: string;
    operatingCompanyId: string;
    branchId: string;
    baseSalary: Prisma.Decimal | null;
  };
}

export interface ListAttendanceFilters {
  month?: string; // YYYY-MM
  startDate?: Date;
  endDate?: Date;
}

/** Descuentos pendientes (aún no liquidados) de un colaborador en un mes. */
export interface PendingDeductionItem {
  employeeId: string;
  employeeName: string;
  areaName: string;
  totalLates: number;
  totalUnjustified: number;
  calculatedDeduction: number;
  attendanceIds: string[];
}

/** Resumen mensual por colaborador, incluye descuentos ya liquidados y pendientes. */
export interface MonthlyAttendanceItem {
  employeeId: string;
  employeeName: string;
  areaName: string;
  totalLates: number;
  totalUnjustified: number;
  calculatedDeduction: number;
  isApplied: boolean;
}

export interface EmployeeAttendanceTotals {
  totalPresent: number;
  totalLate: number;
  totalJustifiedAbsences: number;
  totalUnjustifiedAbsences: number;
  pendingDeductionAmount: number;
}

export abstract class AttendanceRepositoryPort {
  abstract create(data: CreateAttendanceData, tx?: Prisma.TransactionClient): Promise<AttendanceRecord>;
  abstract findById(id: string, tx?: Prisma.TransactionClient): Promise<AttendanceWithEmployee | null>;
  /**
   * Reclasifica una falta de forma condicional: solo si sigue siendo falta y su descuento aún no se liquidó.
   * Si otra operación la movió antes devuelve null.
   */
  abstract reclassify(
    id: string,
    data: ReclassifyAttendanceData,
    tx?: Prisma.TransactionClient,
  ): Promise<AttendanceRecord | null>;
  /** Cantidad de registros con ese estado en el mes calendario de `anyDateInMonth`. */
  abstract countInMonthOf(
    employeeId: string,
    status: AttendanceStatus,
    anyDateInMonth: Date,
    tx?: Prisma.TransactionClient,
  ): Promise<number>;
  abstract findByEmployeeAndDate(
    employeeId: string,
    date: Date,
    tx?: Prisma.TransactionClient,
  ): Promise<AttendanceRecord | null>;
  abstract findManyByEmployee(
    employeeId: string,
    filters?: ListAttendanceFilters,
    tx?: Prisma.TransactionClient,
  ): Promise<AttendanceRecord[]>;
  abstract totalsByEmployee(employeeId: string, tx?: Prisma.TransactionClient): Promise<EmployeeAttendanceTotals>;
  abstract summarizeMonth(
    companyId: string,
    month: string,
    tx?: Prisma.TransactionClient,
  ): Promise<MonthlyAttendanceItem[]>;
  abstract findPendingDeductions(
    companyId: string,
    month: string,
    employeeIds?: string[],
    tx?: Prisma.TransactionClient,
  ): Promise<PendingDeductionItem[]>;
  abstract applyDeductions(
    attendanceIds: string[],
    payrollMonth: string,
    appliedAt: Date,
    tx?: Prisma.TransactionClient,
  ): Promise<number>;
}
