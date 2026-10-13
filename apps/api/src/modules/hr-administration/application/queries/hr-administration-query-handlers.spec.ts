import { ForbiddenException } from '@nestjs/common';
import type { AttendanceRecord, FieldTripRequest, LeaveRequest, VacationRequest } from '@prisma/client';
import { Prisma } from '@prisma/client';
import {
  EmployeeNotFoundError,
  FieldTripNotFoundError,
} from '../../domain/hr-administration-errors';
import {
  BRANCH_ID,
  COMPANY_ID,
  FixedClock,
  ORG_ID,
  buildEmployee,
  buildMatrixAuth,
  buildMemoRepo,
  buildTripEmployee,
  buildWorkContext,
} from '../../testing/hr-administration-test-fixtures';
import { HrAdministrationAccessService } from '../services/hr-administration-access.service';
import type { AttendanceRepositoryPort, EmployeeAttendanceTotals, MonthlyAttendanceItem } from '../ports/attendance-repository.port';
import type { EmployeeRepositoryPort } from '../ports/employee-repository.port';
import type { FieldTripRepositoryPort, FieldTripWithEmployee } from '../ports/field-trip-repository.port';
import type { LeaveRepositoryPort } from '../ports/leave-repository.port';
import type { VacationRepositoryPort, VacationWithEmployee } from '../ports/vacation-repository.port';
import type { TrainingRepositoryPort } from '../ports/training-repository.port';
import type { EmploymentTerminationRepositoryPort } from '../ports/employment-termination-repository.port';
import { GetAttendanceSummaryHandler } from './get-attendance-summary.handler';
import { GetAttendanceSummaryQuery } from './get-attendance-summary.query';
import { GetEmployeeAttendanceHandler } from './get-employee-attendance.handler';
import { GetEmployeeAttendanceQuery } from './get-employee-attendance.query';
import { GetEmployeeDetailHandler, EMPLOYEE_DETAIL_RECENT_LIMIT } from './get-employee-detail.handler';
import { GetEmployeeDetailQuery } from './get-employee-detail.query';
import { GetEmployeeLeavesHandler } from './get-employee-leaves.handler';
import { GetEmployeeLeavesQuery } from './get-employee-leaves.query';
import { GetEmployeeVacationsHandler } from './get-employee-vacations.handler';
import { GetEmployeeVacationsQuery } from './get-employee-vacations.query';
import { GetFieldTripHandler } from './get-field-trip.handler';
import { GetFieldTripQuery } from './get-field-trip.query';
import { GetVacationsCalendarHandler } from './get-vacations-calendar.handler';
import { GetVacationsCalendarQuery } from './get-vacations-calendar.query';
import { ListEmployeesHandler } from './list-employees.handler';
import { ListEmployeesQuery } from './list-employees.query';
import { ListFieldTripsHandler } from './list-field-trips.handler';
import { ListFieldTripsQuery } from './list-field-trips.query';

const UID = 'uid-hr-1';
const EMP_ID = 'emp-1';
const TRIP_ID = 'trip-1';

function setup(role: 'RRHH' | 'GERENCIA' | 'CAMPO' | 'AUDITORIA' | 'forbidden' = 'RRHH') {
  const access = new HrAdministrationAccessService(buildWorkContext(role), buildMatrixAuth());
  const clock = new FixedClock();

  const employees = {
    create: jest.fn(),
    findById: jest.fn(),
    findByCompanyAndDocument: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    markTerminated: jest.fn(),
  } as unknown as jest.Mocked<EmployeeRepositoryPort>;

  const attendance = {
    create: jest.fn(),
    findByEmployeeAndDate: jest.fn(),
    findManyByEmployee: jest.fn(),
    totalsByEmployee: jest.fn(),
    summarizeMonth: jest.fn(),
    findPendingDeductions: jest.fn(),
    applyDeductions: jest.fn(),
    findById: jest.fn(),
    reclassify: jest.fn(),
    countInMonthOf: jest.fn(),
  } as unknown as jest.Mocked<AttendanceRepositoryPort>;

  const leaves = {
    create: jest.fn(),
    findById: jest.fn(),
    findByEmployee: jest.fn(),
    resolve: jest.fn(),
  } as unknown as jest.Mocked<LeaveRepositoryPort>;

  const vacations = {
    create: jest.fn(),
    findByEmployee: jest.fn(),
    findActiveByArea: jest.fn(),
    findCalendar: jest.fn(),
  } as unknown as jest.Mocked<VacationRepositoryPort>;

  const fieldTrips = {
    create: jest.fn(),
    findById: jest.fn(),
    findMany: jest.fn(),
    transition: jest.fn(),
    claimNextDueForEscalation: jest.fn(),
  } as unknown as jest.Mocked<FieldTripRepositoryPort>;

  const terminations = {
    create: jest.fn(),
    findByEmployeeId: jest.fn(),
  } as unknown as jest.Mocked<EmploymentTerminationRepositoryPort>;

  const memoRepo = buildMemoRepo();
  const trainingRepo = {
    create: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    findByEmployee: jest.fn().mockResolvedValue([]),
  } as unknown as jest.Mocked<TrainingRepositoryPort>;

  return { access, clock, employees, attendance, leaves, vacations, fieldTrips, terminations, memoRepo, trainingRepo };
}

function attendanceTotals(over: Partial<EmployeeAttendanceTotals> = {}): EmployeeAttendanceTotals {
  return { totalPresent: 20, totalLate: 2, totalJustifiedAbsences: 0, totalUnjustifiedAbsences: 1, pendingDeductionAmount: 100, ...over };
}

function attendanceRecord(over: Partial<AttendanceRecord> = {}): AttendanceRecord {
  return {
    id: 'att-1', employeeId: EMP_ID, date: new Date('2026-10-08T00:00:00Z'),
    checkInTime: null, checkOutTime: null, status: 'TARDANZA', minutesLate: 15,
    deductionAmount: new Prisma.Decimal(50), isDeductionApplied: false,
    payrollMonth: null, deductionAppliedAt: null, notes: null, justification: null, reclassifiedAt: null, reclassifiedById: null,
    createdById: UID, createdAt: new Date(), updatedAt: new Date(),
    ...over,
  };
}

function leaveRecord(over: Partial<LeaveRequest> = {}): LeaveRequest {
  return {
    id: 'leave-1', employeeId: EMP_ID, type: 'PERMISO_HORAS',
    date: new Date('2026-10-12T00:00:00Z'), startTime: null, endTime: null,
    reason: 'Trámite', status: 'SOLICITADO', authorizedById: null, authorizedByName: null,
    resolutionNotes: null, resolvedAt: null, createdAt: new Date(), updatedAt: new Date(),
    ...over,
  };
}

function vacationRecord(over: Partial<VacationRequest> = {}): VacationRequest {
  return {
    id: 'vac-1', employeeId: EMP_ID, areaId: 'OPERACIONES',
    startDate: new Date('2026-11-02T00:00:00Z'), endDate: new Date('2026-11-15T00:00:00Z'),
    status: 'PROGRAMADA', requestedAt: new Date(), approvedById: UID, approvedAt: new Date(), notes: null,
    createdAt: new Date(), updatedAt: new Date(),
    ...over,
  };
}

function fieldTripRecord(over: Partial<FieldTripWithEmployee> = {}): FieldTripWithEmployee {
  return {
    id: TRIP_ID, employeeId: EMP_ID, destination: 'Sede Norte', objective: 'Entrega',
    estimatedDeparture: new Date(), estimatedReturn: new Date(), actualDeparture: null, actualReturn: null,
    status: 'PENDIENTE_NIVEL_1', authorizationLevel: null, authorizedById: null, authorizedByName: null,
    authorizedAt: null, lateMinutes: 0, returnNotes: null,
    rejectedById: null, rejectedByName: null, rejectedAt: null, rejectedAtLevel: null, rejectionReason: null,
    level1TimeoutAt: new Date(), level2TimeoutAt: null, level3TimeoutAt: null,
    createdAt: new Date(), updatedAt: new Date(),
    employee: buildTripEmployee(),
    ...over,
  };
}

function monthlyItem(over: Partial<MonthlyAttendanceItem> = {}): MonthlyAttendanceItem {
  return {
    employeeId: EMP_ID, employeeName: 'Carlos Perez', areaName: 'Operaciones',
    totalLates: 2, totalUnjustified: 1, calculatedDeduction: 150, isApplied: false,
    ...over,
  };
}

// ─────────────────────────────────────────────
// ListEmployeesHandler
// ─────────────────────────────────────────────
describe('ListEmployeesHandler', () => {
  it('devuelve la lista de empleados del scope autorizado', async () => {
    const { access, employees } = setup('RRHH');
    const handler = new ListEmployeesHandler(access, employees);
    const emp = buildEmployee();
    employees.findMany.mockResolvedValue({ items: [emp], total: 1 });

    const result = await handler.execute(
      new ListEmployeesQuery(UID, COMPANY_ID, BRANCH_ID),
    );

    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(employees.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: COMPANY_ID }),
    );
  });

  it('lanza ForbiddenException si el rol no tiene VIEW_EMPLOYEES', async () => {
    const { access, employees } = setup('CAMPO');
    const handler = new ListEmployeesHandler(access, employees);
    await expect(
      handler.execute(new ListEmployeesQuery(UID, COMPANY_ID, BRANCH_ID)),
    ).rejects.toThrow(ForbiddenException);
  });
});

// ─────────────────────────────────────────────
// GetEmployeeDetailHandler
// ─────────────────────────────────────────────
describe('GetEmployeeDetailHandler', () => {
  it('devuelve el expediente completo del colaborador', async () => {
    const { access, employees, attendance, leaves, vacations, fieldTrips, terminations, memoRepo, trainingRepo } = setup('RRHH');
    const handler = new GetEmployeeDetailHandler(access, employees, attendance, leaves, vacations, fieldTrips, terminations, memoRepo, trainingRepo);
    const emp = buildEmployee();
    employees.findById.mockResolvedValue(emp);
    attendance.totalsByEmployee.mockResolvedValue(attendanceTotals());
    leaves.findByEmployee.mockResolvedValue([leaveRecord()]);
    vacations.findByEmployee.mockResolvedValue([vacationRecord()]);
    fieldTrips.findMany.mockResolvedValue([fieldTripRecord()]);
    terminations.findByEmployeeId.mockResolvedValue(null);

    const result = await handler.execute(new GetEmployeeDetailQuery(UID, EMP_ID));

    expect(result.employee.id).toBe(EMP_ID);
    expect(result.termination).toBeNull();
    expect(leaves.findByEmployee).toHaveBeenCalledWith(EMP_ID, EMPLOYEE_DETAIL_RECENT_LIMIT);
    expect(vacations.findByEmployee).toHaveBeenCalledWith(EMP_ID, EMPLOYEE_DETAIL_RECENT_LIMIT);
    expect(fieldTrips.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ employeeId: EMP_ID, limit: EMPLOYEE_DETAIL_RECENT_LIMIT }),
    );
  });

  it('lanza EmployeeNotFoundError si el empleado no existe', async () => {
    const { access, employees, attendance, leaves, vacations, fieldTrips, terminations, memoRepo, trainingRepo } = setup();
    const handler = new GetEmployeeDetailHandler(access, employees, attendance, leaves, vacations, fieldTrips, terminations, memoRepo, trainingRepo);
    employees.findById.mockResolvedValue(null);

    await expect(
      handler.execute(new GetEmployeeDetailQuery(UID, 'no-existe')),
    ).rejects.toThrow(EmployeeNotFoundError);
  });
});

// ─────────────────────────────────────────────
// GetEmployeeAttendanceHandler
// ─────────────────────────────────────────────
describe('GetEmployeeAttendanceHandler', () => {
  it('devuelve la asistencia del empleado con nombre incluido', async () => {
    const { access, employees, attendance } = setup('RRHH');
    const handler = new GetEmployeeAttendanceHandler(access, attendance, employees);
    const emp = buildEmployee();
    employees.findById.mockResolvedValue(emp);
    attendance.findManyByEmployee.mockResolvedValue([attendanceRecord()]);

    const result = await handler.execute(
      new GetEmployeeAttendanceQuery(UID, EMP_ID),
    );

    expect(result.employeeName).toBe('Carlos Perez');
    expect(result.items).toHaveLength(1);
  });

  it('acepta filtro por mes y lo valida con parsePayrollMonth', async () => {
    const { access, employees, attendance } = setup('RRHH');
    const handler = new GetEmployeeAttendanceHandler(access, attendance, employees);
    employees.findById.mockResolvedValue(buildEmployee());
    attendance.findManyByEmployee.mockResolvedValue([]);

    await expect(
      handler.execute(new GetEmployeeAttendanceQuery(UID, EMP_ID, '2026-10')),
    ).resolves.toBeDefined();

    await expect(
      handler.execute(new GetEmployeeAttendanceQuery(UID, EMP_ID, 'invalid')),
    ).rejects.toThrow();
  });

  it('lanza EmployeeNotFoundError si el empleado no existe', async () => {
    const { access, employees, attendance } = setup();
    const handler = new GetEmployeeAttendanceHandler(access, attendance, employees);
    employees.findById.mockResolvedValue(null);

    await expect(
      handler.execute(new GetEmployeeAttendanceQuery(UID, 'no-existe')),
    ).rejects.toThrow(EmployeeNotFoundError);
  });
});

// ─────────────────────────────────────────────
// GetAttendanceSummaryHandler
// ─────────────────────────────────────────────
describe('GetAttendanceSummaryHandler', () => {
  it('agrega el total de descuentos del mes', async () => {
    const { access, attendance } = setup('RRHH');
    const handler = new GetAttendanceSummaryHandler(access, attendance);
    attendance.summarizeMonth.mockResolvedValue([
      monthlyItem({ calculatedDeduction: 100 }),
      monthlyItem({ employeeId: 'emp-2', calculatedDeduction: 75 }),
    ]);

    const result = await handler.execute(
      new GetAttendanceSummaryQuery(UID, COMPANY_ID, BRANCH_ID, '2026-10'),
    );

    expect(result.totalEmployees).toBe(2);
    expect(result.totalDeductionsAmount).toBe(175);
    expect(result.month).toBe('2026-10');
    expect(attendance.summarizeMonth).toHaveBeenCalledWith(COMPANY_ID, '2026-10');
  });

  it('lanza ForbiddenException si el rol no tiene VIEW_EMPLOYEES ni LOG_ATTENDANCE', async () => {
    const { access, attendance } = setup('CAMPO');
    const handler = new GetAttendanceSummaryHandler(access, attendance);

    await expect(
      handler.execute(new GetAttendanceSummaryQuery(UID, COMPANY_ID, BRANCH_ID, '2026-10')),
    ).rejects.toThrow(ForbiddenException);
  });
});

// ─────────────────────────────────────────────
// GetEmployeeLeavesHandler
// ─────────────────────────────────────────────
describe('GetEmployeeLeavesHandler', () => {
  it('devuelve los permisos del empleado con nombre incluido', async () => {
    const { access, employees, leaves } = setup('RRHH');
    const handler = new GetEmployeeLeavesHandler(access, leaves, employees);
    employees.findById.mockResolvedValue(buildEmployee());
    leaves.findByEmployee.mockResolvedValue([leaveRecord()]);

    const result = await handler.execute(
      new GetEmployeeLeavesQuery(UID, EMP_ID),
    );

    expect(result.employeeName).toBe('Carlos Perez');
    expect(result.items).toHaveLength(1);
  });

  it('lanza EmployeeNotFoundError si el empleado no existe', async () => {
    const { access, employees, leaves } = setup();
    const handler = new GetEmployeeLeavesHandler(access, leaves, employees);
    employees.findById.mockResolvedValue(null);

    await expect(
      handler.execute(new GetEmployeeLeavesQuery(UID, 'x')),
    ).rejects.toThrow(EmployeeNotFoundError);
  });
});

// ─────────────────────────────────────────────
// GetEmployeeVacationsHandler
// ─────────────────────────────────────────────
describe('GetEmployeeVacationsHandler', () => {
  it('devuelve las vacaciones del empleado con nombre e información de área', async () => {
    const { access, employees, vacations } = setup('RRHH');
    const handler = new GetEmployeeVacationsHandler(access, vacations, employees);
    employees.findById.mockResolvedValue(buildEmployee());
    vacations.findByEmployee.mockResolvedValue([vacationRecord()]);

    const result = await handler.execute(
      new GetEmployeeVacationsQuery(UID, EMP_ID),
    );

    expect(result.employeeName).toBe('Carlos Perez');
    expect(result.areaName).toBe('Operaciones y Logística');
    expect(result.items).toHaveLength(1);
  });

  it('lanza EmployeeNotFoundError si el empleado no existe', async () => {
    const { access, employees, vacations } = setup();
    const handler = new GetEmployeeVacationsHandler(access, vacations, employees);
    employees.findById.mockResolvedValue(null);

    await expect(
      handler.execute(new GetEmployeeVacationsQuery(UID, 'x')),
    ).rejects.toThrow(EmployeeNotFoundError);
  });
});

// ─────────────────────────────────────────────
// GetVacationsCalendarHandler
// ─────────────────────────────────────────────
describe('GetVacationsCalendarHandler', () => {
  it('delega en vacations.findCalendar con el scope del contexto', async () => {
    const { access, vacations } = setup('RRHH');
    const handler = new GetVacationsCalendarHandler(access, vacations);
    const calEntry = { ...vacationRecord(), employee: { fullName: 'Carlos', areaName: 'Ops' } } as VacationWithEmployee;
    vacations.findCalendar.mockResolvedValue([calEntry]);

    const result = await handler.execute(
      new GetVacationsCalendarQuery(UID, COMPANY_ID, BRANCH_ID, 2026, 11),
    );

    expect(result).toHaveLength(1);
    expect(vacations.findCalendar).toHaveBeenCalledWith(COMPANY_ID, 2026, 11, undefined);
  });

  it('lanza ForbiddenException si el rol no tiene VIEW_EMPLOYEES ni SCHEDULE_VACATION', async () => {
    const { access, vacations } = setup('CAMPO');
    const handler = new GetVacationsCalendarHandler(access, vacations);

    await expect(
      handler.execute(new GetVacationsCalendarQuery(UID, COMPANY_ID, BRANCH_ID, 2026, 11)),
    ).rejects.toThrow(ForbiddenException);
  });
});

// ─────────────────────────────────────────────
// GetFieldTripHandler
// ─────────────────────────────────────────────
describe('GetFieldTripHandler', () => {
  it('devuelve la salida a campo con datos del empleado', async () => {
    const { access, fieldTrips } = setup('CAMPO');
    const handler = new GetFieldTripHandler(access, fieldTrips);
    const trip = fieldTripRecord();
    fieldTrips.findById.mockResolvedValue(trip);

    const result = await handler.execute(new GetFieldTripQuery(UID, TRIP_ID));

    expect(result.id).toBe(TRIP_ID);
    expect(result.employee.fullName).toBe('Carlos Perez');
  });

  it('lanza FieldTripNotFoundError si la salida no existe', async () => {
    const { access, fieldTrips } = setup('CAMPO');
    const handler = new GetFieldTripHandler(access, fieldTrips);
    fieldTrips.findById.mockResolvedValue(null);

    await expect(
      handler.execute(new GetFieldTripQuery(UID, 'no-existe')),
    ).rejects.toThrow(FieldTripNotFoundError);
  });

  it('lanza ForbiddenException si el rol no tiene REQUEST_FIELD_TRIP ni AUTHORIZE_FIELD_TRIP', async () => {
    const { access, fieldTrips } = setup('AUDITORIA');
    const handler = new GetFieldTripHandler(access, fieldTrips);
    fieldTrips.findById.mockResolvedValue(fieldTripRecord());

    await expect(
      handler.execute(new GetFieldTripQuery(UID, TRIP_ID)),
    ).rejects.toThrow(ForbiddenException);
  });
});

// ─────────────────────────────────────────────
// ListFieldTripsHandler
// ─────────────────────────────────────────────
describe('ListFieldTripsHandler', () => {
  it('devuelve las salidas a campo del scope autorizado', async () => {
    const { access, fieldTrips } = setup('CAMPO');
    const handler = new ListFieldTripsHandler(access, fieldTrips);
    fieldTrips.findMany.mockResolvedValue([fieldTripRecord()]);

    const result = await handler.execute(
      new ListFieldTripsQuery(UID, COMPANY_ID, BRANCH_ID),
    );

    expect(result).toHaveLength(1);
    expect(fieldTrips.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: COMPANY_ID }),
    );
  });

  it('acepta filtro por status', async () => {
    const { access, fieldTrips } = setup('CAMPO');
    const handler = new ListFieldTripsHandler(access, fieldTrips);
    fieldTrips.findMany.mockResolvedValue([]);

    await handler.execute(
      new ListFieldTripsQuery(UID, COMPANY_ID, BRANCH_ID, 'PENDIENTE_NIVEL_1'),
    );

    expect(fieldTrips.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'PENDIENTE_NIVEL_1' }),
    );
  });

  it('lanza ForbiddenException si el rol no tiene REQUEST_FIELD_TRIP ni AUTHORIZE_FIELD_TRIP', async () => {
    const { access, fieldTrips } = setup('AUDITORIA');
    const handler = new ListFieldTripsHandler(access, fieldTrips);

    await expect(
      handler.execute(new ListFieldTripsQuery(UID, COMPANY_ID, BRANCH_ID)),
    ).rejects.toThrow(ForbiddenException);
  });
});
