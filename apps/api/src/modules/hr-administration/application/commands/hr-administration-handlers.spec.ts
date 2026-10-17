import { ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AttendanceRecord, EmploymentTermination, FieldTripRequest, LeaveRequest, VacationRequest } from '@prisma/client';
import {
  AttendanceAlreadyLoggedError,
  AuthorizationLevelNotReachedError,
  CandidateAlreadyEmployeeError,
  DeductionsBeforeMonthEndError,
  DuplicateEmployeeDocumentError,
  EmployeeNotFoundError,
  EmployeeStatusTransitionNotAllowedError,
  EmployeeTerminatedError,
  EmploymentAlreadyTerminatedError,
  FinalSettlementRequiredError,
  InvalidAttendanceRecordError,
  InvalidAttendanceEvidenceError,
  AttendanceEvidenceRequiredError,
  InvalidAuthorizationLevelError,
  InvalidDateRangeError,
  InvalidFieldTripDatesError,
  InvalidLeaveResolutionError,
  LeaveAlreadyResolvedError,
  NoAuthorizationAvailableError,
  TerminationNotesRequiredError,
  VacationOverlapError,
} from '../../domain/hr-administration-errors';
import {
  BRANCH_ID,
  COMPANY_ID,
  FixedClock,
  ORG_ID,
  buildAudit,
  buildDisplayNames,
  buildEmployee,
  buildMatrixAuth,
  buildMemoRepo,
  buildTripEmployee,
  buildOutbox,
  buildTransactionManager,
  buildWorkContext,
} from '../../testing/hr-administration-test-fixtures';
import { HrAdministrationAccessService } from '../services/hr-administration-access.service';
import { FieldTripCascadeService } from '../services/field-trip-cascade.service';
import { HrMemoService } from '../services/hr-memo.service';
import type { EmployeeRepositoryPort } from '../ports/employee-repository.port';
import type { AttendanceRepositoryPort } from '../ports/attendance-repository.port';
import type { LeaveRepositoryPort } from '../ports/leave-repository.port';
import type { VacationRepositoryPort } from '../ports/vacation-repository.port';
import type { FieldTripRepositoryPort } from '../ports/field-trip-repository.port';
import type { EmploymentTerminationRepositoryPort } from '../ports/employment-termination-repository.port';
import { CreateEmployeeCommand } from './create-employee.command';
import { CreateEmployeeHandler } from './create-employee.handler';
import { UpdateEmployeeCommand } from './update-employee.command';
import { UpdateEmployeeHandler } from './update-employee.handler';
import { LogAttendanceCommand } from './log-attendance.command';
import { LogAttendanceHandler } from './log-attendance.handler';
import { ApplyMonthDeductionsCommand } from './apply-month-deductions.command';
import { ApplyMonthDeductionsHandler } from './apply-month-deductions.handler';
import { RequestLeaveCommand } from './request-leave.command';
import { RequestLeaveHandler } from './request-leave.handler';
import { ResolveLeaveCommand } from './resolve-leave.command';
import { ResolveLeaveHandler } from './resolve-leave.handler';
import { ScheduleVacationCommand } from './schedule-vacation.command';
import { ScheduleVacationHandler } from './schedule-vacation.handler';
import { RequestFieldTripCommand } from './request-field-trip.command';
import { RequestFieldTripHandler } from './request-field-trip.handler';
import { AuthorizeFieldTripCommand } from './authorize-field-trip.command';
import { AuthorizeFieldTripHandler } from './authorize-field-trip.handler';
import { AdvanceFieldTripTimeoutCommand } from './advance-field-trip-timeout.command';
import { AdvanceFieldTripTimeoutHandler } from './advance-field-trip-timeout.handler';
import { EvaluateFieldTripReturnCommand } from './evaluate-field-trip-return.command';
import { EvaluateFieldTripReturnHandler } from './evaluate-field-trip-return.handler';
import { TerminateEmploymentCommand } from './terminate-employment.command';
import { TerminateEmploymentHandler } from './terminate-employment.handler';

const UID = 'uid-1';

type Role = 'RRHH' | 'GERENCIA' | 'ADMINISTRACION' | 'AUDITORIA' | 'CAMPO';

function setup(role: Role = 'RRHH') {
  const access = new HrAdministrationAccessService(buildWorkContext(role), buildMatrixAuth());
  const tm = buildTransactionManager();
  const clock = new FixedClock();
  const audit = buildAudit();
  const outbox = buildOutbox();
  const displayNames = buildDisplayNames('Autorizador de prueba');
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
    countInMonthOf: jest.fn().mockResolvedValue(1),
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
  const cascade = new FieldTripCascadeService(fieldTrips, employees);
  const memoRepo = buildMemoRepo();
  const memos = new HrMemoService(memoRepo, attendance, audit);
  return {
    memoRepo,
    memos, access, tm, clock, audit, outbox, displayNames, employees, attendance, leaves, vacations, fieldTrips, terminations, cascade };
}

const EMP_SCOPE = { organizationId: ORG_ID, operatingCompanyId: COMPANY_ID, branchId: BRANCH_ID };
const tripEmployee = buildTripEmployee();

function attendanceRecord(over: Partial<AttendanceRecord> = {}): AttendanceRecord {
  return {
    id: 'att-1',
    employeeId: 'emp-1',
    date: new Date('2026-10-08T00:00:00Z'),
    checkInTime: null,
    checkOutTime: null,
    status: 'FALTA_INJUSTIFICADA',
    minutesLate: 0,
    deductionAmount: new Prisma.Decimal(100),
    isDeductionApplied: false,
    payrollMonth: null,
    deductionAppliedAt: null,
    justification: null,
    reclassifiedAt: null,
    reclassifiedById: null,
    evidenceKind: null, evidenceStorageRef: null, evidenceUrl: null, evidenceCapturedAt: null, evidenceNote: null, evidenceCorroboratedById: null, evidenceCorroboratedAt: null,
    notes: null,
    createdById: UID,
    createdAt: new Date('2026-10-08T12:00:00Z'),
    updatedAt: new Date('2026-10-08T12:00:00Z'),
    ...over,
  };
}

function leave(over: Partial<LeaveRequest> = {}): LeaveRequest {
  return {
    id: 'leave-1',
    employeeId: 'emp-1',
    type: 'PERMISO_HORAS',
    date: new Date('2026-10-12T00:00:00Z'),
    startTime: null,
    endTime: null,
    reason: 'Trámite personal',
    status: 'SOLICITADO',
    authorizedById: null,
    authorizedByName: null,
    resolutionNotes: null,
    resolvedAt: null,
    createdAt: new Date('2026-10-09T08:00:00Z'),
    updatedAt: new Date('2026-10-09T08:00:00Z'),
    ...over,
  };
}

function vacation(over: Partial<VacationRequest> = {}): VacationRequest {
  return {
    id: 'vac-1',
    employeeId: 'emp-2',
    areaId: 'OPERACIONES',
    startDate: new Date('2026-11-02T00:00:00Z'),
    endDate: new Date('2026-11-15T00:00:00Z'),
    status: 'PROGRAMADA',
    requestedAt: new Date('2026-10-01T00:00:00Z'),
    approvedById: UID,
    approvedAt: new Date('2026-10-01T00:00:00Z'),
    notes: null,
    createdAt: new Date('2026-10-01T00:00:00Z'),
    updatedAt: new Date('2026-10-01T00:00:00Z'),
    ...over,
  };
}

function fieldTrip(over: Partial<FieldTripRequest> = {}) {
  const base: FieldTripRequest = {
    id: 'ft-1',
    employeeId: 'emp-1',
    destination: 'Taller Huachipa',
    objective: 'Inspección técnica',
    estimatedDeparture: new Date('2026-10-09T09:00:00Z'),
    estimatedReturn: new Date('2026-10-09T13:00:00Z'),
    actualDeparture: null,
    actualReturn: null,
    status: 'PENDIENTE_NIVEL_1',
    authorizationLevel: null,
    authorizedById: null,
    authorizedByName: null,
    authorizedAt: null,
    level1TimeoutAt: new Date('2026-10-09T08:05:00Z'),
    level2TimeoutAt: null,
    level3TimeoutAt: null,
    lateMinutes: 0,
    returnNotes: null,
    rejectedById: null, rejectedByName: null, rejectedAt: null, rejectedAtLevel: null, rejectionReason: null,
    createdAt: new Date('2026-10-09T08:00:00Z'),
    updatedAt: new Date('2026-10-09T08:00:00Z'),
  };
  return { ...base, ...over, employee: tripEmployee };
}

describe('CreateEmployeeHandler', () => {
  const cmd = () =>
    new CreateEmployeeCommand(
      UID, COMPANY_ID, BRANCH_ID, 'DNI', ' 45678912 ', ' Carlos Perez ', 'OPERACIONES', 'Operaciones', 'Auxiliar',
      new Date('2026-10-01T00:00:00Z'), null, null, 1500,
    );

  it('un rol de solo lectura (Auditoria) no puede registrar colaboradores', async () => {
    const s = setup('AUDITORIA');
    const handler = new CreateEmployeeHandler(s.access, s.employees, s.tm, s.audit);
    await expect(handler.execute(cmd())).rejects.toBeInstanceOf(ForbiddenException);
    expect(s.employees.create).not.toHaveBeenCalled();
  });

  it('rechaza un documento ya registrado en la empresa', async () => {
    const s = setup();
    s.employees.findByCompanyAndDocument.mockResolvedValue(buildEmployee());
    const handler = new CreateEmployeeHandler(s.access, s.employees, s.tm, s.audit);
    await expect(handler.execute(cmd())).rejects.toBeInstanceOf(DuplicateEmployeeDocumentError);
  });

  it('crea el colaborador en periodo de prueba con el alcance del contexto y audita', async () => {
    const s = setup();
    s.employees.findByCompanyAndDocument.mockResolvedValue(null);
    s.employees.create.mockResolvedValue(buildEmployee({ status: 'PERIODO_PRUEBA' }));
    const handler = new CreateEmployeeHandler(s.access, s.employees, s.tm, s.audit);
    await handler.execute(cmd());
    expect(s.employees.findByCompanyAndDocument).toHaveBeenCalledWith(COMPANY_ID, '45678912', s.tm.tx);
    expect(s.employees.create).toHaveBeenCalledWith(
      expect.objectContaining({ ...EMP_SCOPE, documentNumber: '45678912', fullName: 'Carlos Perez' }),
      s.tm.tx,
    );
    expect(s.audit.recordHrAdministrationEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'EMPLOYEE_CREATED', entityType: 'employee' }),
      s.tm.tx,
    );
  });

  it('traduce la violacion de unicidad concurrente (documento o candidato ya vinculado)', async () => {
    const s = setup();
    s.employees.findByCompanyAndDocument.mockResolvedValue(null);
    const handler = new CreateEmployeeHandler(s.access, s.employees, s.tm, s.audit);
    s.employees.create.mockRejectedValueOnce({ code: 'P2002', meta: { target: ['operating_company_id', 'document_number'] } });
    await expect(handler.execute(cmd())).rejects.toBeInstanceOf(DuplicateEmployeeDocumentError);
    s.employees.create.mockRejectedValueOnce({ code: 'P2002', meta: { target: ['candidate_id'] } });
    await expect(handler.execute(cmd())).rejects.toBeInstanceOf(CandidateAlreadyEmployeeError);
  });
});

describe('UpdateEmployeeHandler', () => {
  it('404 si el colaborador no existe', async () => {
    const s = setup();
    s.employees.findById.mockResolvedValue(null);
    const handler = new UpdateEmployeeHandler(s.access, s.employees, s.tm, s.audit);
    await expect(handler.execute(new UpdateEmployeeCommand(UID, 'emp-x', { jobTitle: 'Jefe' }))).rejects.toBeInstanceOf(
      EmployeeNotFoundError,
    );
  });

  it('actualiza dentro de la transaccion y audita', async () => {
    const s = setup();
    s.employees.findById.mockResolvedValue(buildEmployee());
    s.employees.update.mockResolvedValue(buildEmployee({ jobTitle: 'Jefe' }));
    const handler = new UpdateEmployeeHandler(s.access, s.employees, s.tm, s.audit);
    await handler.execute(new UpdateEmployeeCommand(UID, 'emp-1', { jobTitle: 'Jefe' }));
    expect(s.employees.update).toHaveBeenCalledWith('emp-1', { jobTitle: 'Jefe' }, s.tm.tx);
    expect(s.audit.recordHrAdministrationEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'EMPLOYEE_UPDATED' }),
      s.tm.tx,
    );
  });

  it('no permite terminar la relación laboral por edición (solo vía desvinculación)', async () => {
    const s = setup();
    s.employees.findById.mockResolvedValue(buildEmployee());
    const handler = new UpdateEmployeeHandler(s.access, s.employees, s.tm, s.audit);
    await expect(handler.execute(new UpdateEmployeeCommand(UID, 'emp-1', { status: 'TERMINADO' }))).rejects.toBeInstanceOf(
      EmployeeStatusTransitionNotAllowedError,
    );
    expect(s.employees.update).not.toHaveBeenCalled();
  });

  it('un colaborador terminado no admite edición', async () => {
    const s = setup();
    s.employees.findById.mockResolvedValue(buildEmployee({ status: 'TERMINADO' }));
    const handler = new UpdateEmployeeHandler(s.access, s.employees, s.tm, s.audit);
    await expect(handler.execute(new UpdateEmployeeCommand(UID, 'emp-1', { jobTitle: 'X' }))).rejects.toBeInstanceOf(
      EmployeeTerminatedError,
    );
  });
});

describe('LogAttendanceHandler (BR-ADP-001)', () => {
  const photo = {
    kind: 'WHATSAPP_PHOTO' as const,
    storageRef: `companies/${COMPANY_ID}/employees/emp-1/attendance/base.jpg`,
    capturedAtLocal: new Date('2026-10-08T13:02:00Z'),
  };
  const cmd = (status: LogAttendanceCommand['status'], minutesLate?: number, deductionAmount?: number) =>
    new LogAttendanceCommand(UID, 'emp-1', new Date('2026-10-08T00:00:00Z'), status, minutesLate, deductionAmount, null, null, null, photo);
  const cmdNoEvidence = (status: LogAttendanceCommand['status'], minutesLate?: number) =>
    new LogAttendanceCommand(UID, 'emp-1', new Date('2026-10-08T00:00:00Z'), status, minutesLate);

  describe('evidencia fotografica (DEC-ADP-ATT-EVIDENCE-001)', () => {
    const evidenceCmd = (evidence: LogAttendanceCommand['evidence']) =>
      new LogAttendanceCommand(UID, 'emp-1', new Date('2026-10-08T00:00:00Z'), 'PRESENTE', undefined, undefined, null, null, null, evidence);
    const okEvidence = {
      kind: 'WHATSAPP_PHOTO' as const,
      storageRef: ` companies/${COMPANY_ID}/employees/emp-1/attendance/foto.jpg `,
      capturedAtLocal: new Date('2026-10-08T13:02:00Z'),
      note: ' foto del grupo ',
    };

    it.each(['PRESENTE', 'TARDANZA'] as const)('sin evidencia: %s se rechaza con ATTENDANCE_EVIDENCE_REQUIRED (DEC-ADP-ATT-EVIDENCE-002)', async (status) => {
      const s = setup();
      s.employees.findById.mockResolvedValue(buildEmployee());
      const handler = new LogAttendanceHandler(s.access, s.attendance, s.employees, s.tm, s.audit, s.memos);
      const err = await handler.execute(cmdNoEvidence(status, status === 'TARDANZA' ? 10 : undefined)).catch((e) => e);
      expect(err).toBeInstanceOf(AttendanceEvidenceRequiredError);
      expect(err.code).toBe('ATTENDANCE_EVIDENCE_REQUIRED');
      expect(s.attendance.create).not.toHaveBeenCalled();
    });

    it('una falta no exige foto: se registra con evidenceMissing = true', async () => {
      const s = setup();
      s.employees.findById.mockResolvedValue(buildEmployee());
      s.attendance.findByEmployeeAndDate.mockResolvedValue(null);
      s.attendance.create.mockResolvedValue(attendanceRecord({ status: 'FALTA_INJUSTIFICADA' }));
      const handler = new LogAttendanceHandler(s.access, s.attendance, s.employees, s.tm, s.audit, s.memos);
      const result = await handler.execute(cmdNoEvidence('FALTA_INJUSTIFICADA'));
      expect(result.evidenceMissing).toBe(true);
      expect(s.attendance.create).toHaveBeenCalledWith(expect.objectContaining({ evidence: null }), s.tm.tx);
    });

    it('rechaza un storageRef que no pertenece al colaborador (no subido con su URL firmada)', async () => {
      const s = setup();
      s.employees.findById.mockResolvedValue(buildEmployee());
      const handler = new LogAttendanceHandler(s.access, s.attendance, s.employees, s.tm, s.audit, s.memos);
      await expect(
        handler.execute(evidenceCmd({ ...okEvidence, storageRef: `companies/${COMPANY_ID}/employees/otro/attendance/f.jpg` })),
      ).rejects.toBeInstanceOf(InvalidAttendanceEvidenceError);
      expect(s.attendance.create).not.toHaveBeenCalled();
    });

    it('con evidencia: la guarda normalizada y registra quien la corroboro', async () => {
      const s = setup();
      s.employees.findById.mockResolvedValue(buildEmployee());
      s.attendance.findByEmployeeAndDate.mockResolvedValue(null);
      s.attendance.create.mockResolvedValue(attendanceRecord({ status: 'PRESENTE', evidenceKind: 'WHATSAPP_PHOTO' }));
      const handler = new LogAttendanceHandler(s.access, s.attendance, s.employees, s.tm, s.audit, s.memos);
      const result = await handler.execute(evidenceCmd(okEvidence));
      expect(result.evidenceMissing).toBe(false);
      expect(s.attendance.create).toHaveBeenCalledWith(
        expect.objectContaining({
          evidence: expect.objectContaining({
            kind: 'WHATSAPP_PHOTO',
            storageRef: `companies/${COMPANY_ID}/employees/emp-1/attendance/foto.jpg`,
            url: null,
            capturedAt: okEvidence.capturedAtLocal,
            note: 'foto del grupo',
            corroboratedById: UID,
          }),
        }),
        s.tm.tx,
      );
    });

    it.each([
      ['sin storageRef ni url', { ...okEvidence, storageRef: null }],
      ['fecha invalida', { ...okEvidence, capturedAtLocal: new Date(Number.NaN) }],
      ['fecha futura', { ...okEvidence, capturedAtLocal: new Date(Date.now() + 3_600_000) }],
      ['tipo no admitido', { ...okEvidence, kind: 'BIOMETRIC' as never }],
    ])('rechaza evidencia mal formada: %s', async (_name, evidence) => {
      const s = setup();
      s.employees.findById.mockResolvedValue(buildEmployee());
      const handler = new LogAttendanceHandler(s.access, s.attendance, s.employees, s.tm, s.audit, s.memos);
      await expect(handler.execute(evidenceCmd(evidence))).rejects.toBeInstanceOf(InvalidAttendanceEvidenceError);
      expect(s.attendance.create).not.toHaveBeenCalled();
    });
  });

  it('una falta injustificada registra un día de descuento PENDIENTE (no se descuenta en la quincena)', async () => {
    const s = setup();
    s.employees.findById.mockResolvedValue(buildEmployee());
    s.attendance.findByEmployeeAndDate.mockResolvedValue(null);
    s.attendance.create.mockResolvedValue(attendanceRecord());
    const handler = new LogAttendanceHandler(s.access, s.attendance, s.employees, s.tm, s.audit, s.memos);
    await handler.execute(cmd('FALTA_INJUSTIFICADA'));
    expect(s.attendance.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'FALTA_INJUSTIFICADA', deductionAmount: 100, minutesLate: 0 }),
      s.tm.tx,
    );
  });

  it('una falta justificada nunca genera descuento, aunque el cliente envíe un monto', async () => {
    const s = setup();
    s.employees.findById.mockResolvedValue(buildEmployee());
    s.attendance.findByEmployeeAndDate.mockResolvedValue(null);
    s.attendance.create.mockResolvedValue(attendanceRecord({ status: 'FALTA_JUSTIFICADA', deductionAmount: new Prisma.Decimal(0) }));
    const handler = new LogAttendanceHandler(s.access, s.attendance, s.employees, s.tm, s.audit, s.memos);
    await handler.execute(cmd('FALTA_JUSTIFICADA', 0, 500));
    expect(s.attendance.create).toHaveBeenCalledWith(expect.objectContaining({ deductionAmount: 0 }), s.tm.tx);
  });

  it('una tardanza sin minutos es inválida', async () => {
    const s = setup();
    s.employees.findById.mockResolvedValue(buildEmployee());
    s.attendance.findByEmployeeAndDate.mockResolvedValue(null);
    const handler = new LogAttendanceHandler(s.access, s.attendance, s.employees, s.tm, s.audit, s.memos);
    await expect(handler.execute(cmd('TARDANZA', 0))).rejects.toBeInstanceOf(InvalidAttendanceRecordError);
  });

  it('rechaza un segundo registro para la misma fecha', async () => {
    const s = setup();
    s.employees.findById.mockResolvedValue(buildEmployee());
    s.attendance.findByEmployeeAndDate.mockResolvedValue(attendanceRecord());
    const handler = new LogAttendanceHandler(s.access, s.attendance, s.employees, s.tm, s.audit, s.memos);
    await expect(handler.execute(cmd('PRESENTE'))).rejects.toBeInstanceOf(AttendanceAlreadyLoggedError);
  });

  it('no registra asistencia de un colaborador terminado', async () => {
    const s = setup();
    s.employees.findById.mockResolvedValue(buildEmployee({ status: 'TERMINADO' }));
    const handler = new LogAttendanceHandler(s.access, s.attendance, s.employees, s.tm, s.audit, s.memos);
    await expect(handler.execute(cmd('PRESENTE'))).rejects.toBeInstanceOf(EmployeeTerminatedError);
  });

  it('403 para un rol sin LOG_ATTENDANCE (Campo)', async () => {
    const s = setup('CAMPO');
    s.employees.findById.mockResolvedValue(buildEmployee());
    const handler = new LogAttendanceHandler(s.access, s.attendance, s.employees, s.tm, s.audit, s.memos);
    await expect(handler.execute(cmd('PRESENTE'))).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('ApplyMonthDeductionsHandler (BR-ADP-001, SC-ADP-004)', () => {
  const pending = [
    { employeeId: 'emp-1', employeeName: 'Carlos', areaName: 'Ops', totalLates: 1, totalUnjustified: 1, calculatedDeduction: 106.25, attendanceIds: ['a1', 'a2'] },
  ];

  it('no aplica descuentos en la quincena (mes aún abierto)', async () => {
    const s = setup();
    s.clock.set(new Date('2026-10-15T17:00:00Z'));
    const handler = new ApplyMonthDeductionsHandler(s.access, s.attendance, s.tm, s.clock, s.audit);
    await expect(handler.execute(new ApplyMonthDeductionsCommand(UID, COMPANY_ID, BRANCH_ID, '2026-10'))).rejects.toBeInstanceOf(
      DeductionsBeforeMonthEndError,
    );
    expect(s.attendance.applyDeductions).not.toHaveBeenCalled();
  });

  it('al cierre de mes liquida los descuentos pendientes y audita', async () => {
    const s = setup();
    s.clock.set(new Date('2026-10-31T15:00:00Z'));
    s.attendance.findPendingDeductions.mockResolvedValue(pending);
    s.attendance.applyDeductions.mockResolvedValue(2);
    const handler = new ApplyMonthDeductionsHandler(s.access, s.attendance, s.tm, s.clock, s.audit);
    const result = await handler.execute(new ApplyMonthDeductionsCommand(UID, COMPANY_ID, BRANCH_ID, '2026-10'));
    expect(result).toEqual({
      month: '2026-10',
      affectedEmployeesCount: 1,
      totalDeductionsApplied: 106.25,
      totalRecordsUpdated: 2,
    });
    expect(s.attendance.applyDeductions).toHaveBeenCalledWith(['a1', 'a2'], '2026-10', s.clock.now(), s.tm.tx);
    expect(s.audit.recordHrAdministrationEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'DEDUCTIONS_APPLIED' }),
      s.tm.tx,
    );
  });

  it('es idempotente: sin pendientes devuelve ceros y no audita', async () => {
    const s = setup();
    s.clock.set(new Date('2026-11-02T15:00:00Z'));
    s.attendance.findPendingDeductions.mockResolvedValue([]);
    const handler = new ApplyMonthDeductionsHandler(s.access, s.attendance, s.tm, s.clock, s.audit);
    const result = await handler.execute(new ApplyMonthDeductionsCommand(UID, COMPANY_ID, BRANCH_ID, '2026-10'));
    expect(result.affectedEmployeesCount).toBe(0);
    expect(s.audit.recordHrAdministrationEvent).not.toHaveBeenCalled();
  });

  it('exige MANAGE_EMPLOYEES: Auditoría no puede aplicar descuentos', async () => {
    const s = setup('AUDITORIA');
    s.clock.set(new Date('2026-10-31T15:00:00Z'));
    const handler = new ApplyMonthDeductionsHandler(s.access, s.attendance, s.tm, s.clock, s.audit);
    await expect(handler.execute(new ApplyMonthDeductionsCommand(UID, COMPANY_ID, BRANCH_ID, '2026-10'))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});

describe('RequestLeaveHandler / ResolveLeaveHandler (BR-ADP-003)', () => {
  const requestCmd = () => new RequestLeaveCommand(UID, 'emp-1', 'PERMISO_HORAS', new Date('2026-10-12T00:00:00Z'), ' Trámite ');

  it('registra la solicitud como SOLICITADO y audita', async () => {
    const s = setup('ADMINISTRACION');
    s.employees.findById.mockResolvedValue(buildEmployee());
    s.leaves.create.mockResolvedValue(leave());
    const handler = new RequestLeaveHandler(s.access, s.leaves, s.employees, s.tm, s.audit);
    const created = await handler.execute(requestCmd());
    expect(created.status).toBe('SOLICITADO');
    expect(s.leaves.create).toHaveBeenCalledWith(expect.objectContaining({ reason: 'Trámite' }), s.tm.tx);
  });

  it('Auditoría (solo lectura) no puede solicitar permisos', async () => {
    const s = setup('AUDITORIA');
    s.employees.findById.mockResolvedValue(buildEmployee());
    const handler = new RequestLeaveHandler(s.access, s.leaves, s.employees, s.tm, s.audit);
    await expect(handler.execute(requestCmd())).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rechaza una ventana horaria invertida', async () => {
    const s = setup();
    s.employees.findById.mockResolvedValue(buildEmployee());
    const handler = new RequestLeaveHandler(s.access, s.leaves, s.employees, s.tm, s.audit);
    await expect(
      handler.execute(
        new RequestLeaveCommand(UID, 'emp-1', 'SALIDA_ANTES_DE_HORA', new Date('2026-10-12T00:00:00Z'), 'x', new Date('2026-10-12T15:00:00Z'), new Date('2026-10-12T14:00:00Z')),
      ),
    ).rejects.toBeInstanceOf(InvalidDateRangeError);
  });

  it('solo quien tiene AUTHORIZE_LEAVE resuelve: Administración queda fuera (BR-ADP-003)', async () => {
    const s = setup('ADMINISTRACION');
    s.leaves.findById.mockResolvedValue({ ...leave(), employee: tripEmployee });
    const handler = new ResolveLeaveHandler(s.access, s.leaves, s.displayNames, s.tm, s.clock, s.audit);
    await expect(handler.execute(new ResolveLeaveCommand(UID, 'leave-1', 'AUTORIZADO'))).rejects.toBeInstanceOf(ForbiddenException);
    expect(s.leaves.resolve).not.toHaveBeenCalled();
  });

  it('autoriza (Solicitado -> Autorizado) guardando quién y cuándo', async () => {
    const s = setup('RRHH');
    s.leaves.findById.mockResolvedValue({ ...leave(), employee: tripEmployee });
    s.leaves.resolve.mockResolvedValue(leave({ status: 'AUTORIZADO', authorizedById: UID, authorizedByName: 'Autorizador de prueba' }));
    const handler = new ResolveLeaveHandler(s.access, s.leaves, s.displayNames, s.tm, s.clock, s.audit);
    const result = await handler.execute(new ResolveLeaveCommand(UID, 'leave-1', 'AUTORIZADO', ' ok '));
    expect(result.status).toBe('AUTORIZADO');
    expect(s.leaves.resolve).toHaveBeenCalledWith(
      'leave-1',
      expect.objectContaining({ status: 'AUTORIZADO', authorizedById: UID, authorizedByName: 'Autorizador de prueba', resolutionNotes: 'ok' }),
      s.tm.tx,
    );
  });

  it('una solicitud ya resuelta no se resuelve dos veces', async () => {
    const s = setup('RRHH');
    s.leaves.findById.mockResolvedValue({ ...leave({ status: 'DENEGADO' }), employee: tripEmployee });
    const handler = new ResolveLeaveHandler(s.access, s.leaves, s.displayNames, s.tm, s.clock, s.audit);
    await expect(handler.execute(new ResolveLeaveCommand(UID, 'leave-1', 'AUTORIZADO'))).rejects.toBeInstanceOf(
      LeaveAlreadyResolvedError,
    );
  });

  it('rechaza estados de resolución legados (APROBADO/RECHAZADO)', async () => {
    const s = setup('RRHH');
    const handler = new ResolveLeaveHandler(s.access, s.leaves, s.displayNames, s.tm, s.clock, s.audit);
    await expect(
      handler.execute(new ResolveLeaveCommand(UID, 'leave-1', 'APROBADO' as unknown as 'AUTORIZADO')),
    ).rejects.toBeInstanceOf(InvalidLeaveResolutionError);
  });
});

describe('ScheduleVacationHandler (BR-ADP-002)', () => {
  const cmd = (start: string, end: string) =>
    new ScheduleVacationCommand(UID, 'emp-1', new Date(`${start}T00:00:00Z`), new Date(`${end}T00:00:00Z`));

  it('sin superposición en el área queda PROGRAMADA (SC-ADP-001.02) y corre en transacción Serializable', async () => {
    const s = setup('ADMINISTRACION');
    s.employees.findById.mockResolvedValue(buildEmployee());
    s.vacations.findActiveByArea.mockResolvedValue([vacation()]);
    s.vacations.create.mockResolvedValue(vacation({ id: 'vac-2', employeeId: 'emp-1', startDate: new Date('2026-12-01T00:00:00Z') }));
    const handler = new ScheduleVacationHandler(s.access, s.vacations, s.employees, s.tm, s.clock, s.audit);
    await handler.execute(cmd('2026-12-01', '2026-12-10'));
    expect(s.vacations.findActiveByArea).toHaveBeenCalledWith(COMPANY_ID, 'OPERACIONES', s.tm.tx);
    expect(s.vacations.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'PROGRAMADA', approvedById: UID, areaId: 'OPERACIONES' }),
      s.tm.tx,
    );
    expect(s.tm.run).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  });

  it('si otra persona del área ya tiene esas fechas, rechaza con VACATION_OVERLAP (prioridad a quien pidió primero)', async () => {
    const s = setup();
    s.employees.findById.mockResolvedValue(buildEmployee());
    s.vacations.findActiveByArea.mockResolvedValue([vacation()]);
    const handler = new ScheduleVacationHandler(s.access, s.vacations, s.employees, s.tm, s.clock, s.audit);
    await expect(handler.execute(cmd('2026-11-10', '2026-11-20'))).rejects.toBeInstanceOf(VacationOverlapError);
    expect(s.vacations.create).not.toHaveBeenCalled();
  });

  it('rango de fechas invertido', async () => {
    const s = setup();
    s.employees.findById.mockResolvedValue(buildEmployee());
    const handler = new ScheduleVacationHandler(s.access, s.vacations, s.employees, s.tm, s.clock, s.audit);
    await expect(handler.execute(cmd('2026-12-10', '2026-12-01'))).rejects.toBeInstanceOf(InvalidDateRangeError);
  });

  it('un colaborador terminado no programa vacaciones', async () => {
    const s = setup();
    s.employees.findById.mockResolvedValue(buildEmployee({ status: 'TERMINADO' }));
    const handler = new ScheduleVacationHandler(s.access, s.vacations, s.employees, s.tm, s.clock, s.audit);
    await expect(handler.execute(cmd('2026-12-01', '2026-12-10'))).rejects.toBeInstanceOf(EmployeeTerminatedError);
  });

  it('Auditoría no programa vacaciones', async () => {
    const s = setup('AUDITORIA');
    s.employees.findById.mockResolvedValue(buildEmployee());
    const handler = new ScheduleVacationHandler(s.access, s.vacations, s.employees, s.tm, s.clock, s.audit);
    await expect(handler.execute(cmd('2026-12-01', '2026-12-10'))).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('Cascada de salida a campo (BR-ADP-004 / BR-ADP-005)', () => {
  it('RequestFieldTrip: nace PENDIENTE_NIVEL_1 con 5 minutos de temporizador', async () => {
    const s = setup('CAMPO');
    s.employees.findById.mockResolvedValue(buildEmployee());
    s.fieldTrips.create.mockResolvedValue(fieldTrip());
    const handler = new RequestFieldTripHandler(s.access, s.fieldTrips, s.employees, s.tm, s.clock, s.audit);
    await handler.execute(
      new RequestFieldTripCommand(UID, 'emp-1', ' Taller ', ' Inspección ', new Date('2026-10-09T09:00:00Z'), new Date('2026-10-09T13:00:00Z')),
    );
    expect(s.fieldTrips.create).toHaveBeenCalledWith(
      expect.objectContaining({ destination: 'Taller', level1TimeoutAt: new Date('2026-10-09T08:05:00Z') }),
      s.tm.tx,
    );
  });

  it('RequestFieldTrip: la salida debe ser anterior al retorno', async () => {
    const s = setup();
    s.employees.findById.mockResolvedValue(buildEmployee());
    const handler = new RequestFieldTripHandler(s.access, s.fieldTrips, s.employees, s.tm, s.clock, s.audit);
    await expect(
      handler.execute(new RequestFieldTripCommand(UID, 'emp-1', 'a', 'b', new Date('2026-10-09T13:00:00Z'), new Date('2026-10-09T09:00:00Z'))),
    ).rejects.toBeInstanceOf(InvalidFieldTripDatesError);
  });

  it('AuthorizeFieldTrip: solo jefatura (AUTHORIZE_FIELD_TRIP); Campo no autoriza', async () => {
    const s = setup('CAMPO');
    s.fieldTrips.findById.mockResolvedValue(fieldTrip());
    const handler = new AuthorizeFieldTripHandler(s.access, s.fieldTrips, s.cascade, s.displayNames, s.tm, s.clock, s.audit);
    await expect(handler.execute(new AuthorizeFieldTripCommand(UID, 'ft-1', 1))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('AuthorizeFieldTrip: registra el nivel alcanzado y quién autorizó', async () => {
    const s = setup('RRHH');
    s.fieldTrips.findById.mockResolvedValue(fieldTrip({ status: 'PENDIENTE_NIVEL_2' }));
    s.fieldTrips.transition.mockResolvedValue(fieldTrip({ status: 'AUTORIZADA', authorizationLevel: 2 }));
    const handler = new AuthorizeFieldTripHandler(s.access, s.fieldTrips, s.cascade, s.displayNames, s.tm, s.clock, s.audit);
    const result = await handler.execute(new AuthorizeFieldTripCommand(UID, 'ft-1', 2, 'ok'));
    expect(result.authorizationLevel).toBe(2);
    expect(s.fieldTrips.transition).toHaveBeenCalledWith(
      'ft-1',
      ['PENDIENTE_NIVEL_1', 'PENDIENTE_NIVEL_2', 'PENDIENTE_NIVEL_3'],
      expect.objectContaining({ status: 'AUTORIZADA', authorizationLevel: 2, authorizedById: UID, authorizedByName: 'Autorizador de prueba' }),
      s.tm.tx,
    );
    expect(s.audit.recordHrAdministrationEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'FIELD_TRIP_AUTHORIZED' }),
      s.tm.tx,
    );
  });

  it('AuthorizeFieldTrip: el nivel 4 nunca es válido y no se puede saltar al nivel 3', async () => {
    const s = setup('RRHH');
    s.fieldTrips.findById.mockResolvedValue(fieldTrip());
    const handler = new AuthorizeFieldTripHandler(s.access, s.fieldTrips, s.cascade, s.displayNames, s.tm, s.clock, s.audit);
    await expect(handler.execute(new AuthorizeFieldTripCommand(UID, 'ft-1', 4))).rejects.toBeInstanceOf(
      InvalidAuthorizationLevelError,
    );
    await expect(handler.execute(new AuthorizeFieldTripCommand(UID, 'ft-1', 3))).rejects.toBeInstanceOf(
      AuthorizationLevelNotReachedError,
    );
  });

  it('AuthorizeFieldTrip: una salida NO_AUTORIZADA no se aprueba por defecto (NO_AUTHORIZATION_AVAILABLE)', async () => {
    const s = setup('RRHH');
    s.fieldTrips.findById.mockResolvedValue(fieldTrip({ status: 'NO_AUTORIZADA' }));
    const handler = new AuthorizeFieldTripHandler(s.access, s.fieldTrips, s.cascade, s.displayNames, s.tm, s.clock, s.audit);
    await expect(handler.execute(new AuthorizeFieldTripCommand(UID, 'ft-1', 3))).rejects.toBeInstanceOf(
      NoAuthorizationAvailableError,
    );
  });

  it('AdvanceFieldTripTimeout: tras vencer el nivel 3 termina en NO_AUTORIZADA con mensaje y sin 4to nivel', async () => {
    const s = setup('RRHH');
    s.clock.set(new Date('2026-10-09T08:30:00Z'));
    const level3 = fieldTrip({ status: 'PENDIENTE_NIVEL_3', level3TimeoutAt: new Date('2026-10-09T08:20:00Z') });
    s.fieldTrips.findById.mockResolvedValue(level3);
    s.fieldTrips.transition.mockResolvedValue(fieldTrip({ status: 'NO_AUTORIZADA' }));
    const handler = new AdvanceFieldTripTimeoutHandler(s.access, s.fieldTrips, s.cascade, s.tm, s.clock, s.audit);
    const result = await handler.execute(new AdvanceFieldTripTimeoutCommand(UID, 'ft-1'));
    expect(result.fieldTrip.status).toBe('NO_AUTORIZADA');
    expect(result.message).toContain('Nadie autorizó');
    expect(s.audit.recordHrAdministrationEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'FIELD_TRIP_NOT_AUTHORIZED' }),
      s.tm.tx,
    );
  });

  const returnCmd = (actual: string) => new EvaluateFieldTripReturnCommand(UID, 'ft-1', new Date(actual), ' ok ');

  it('EvaluateFieldTripReturn: 1ª tardanza es advertencia (BR-ADP-005)', async () => {
    const s = setup('ADMINISTRACION');
    s.fieldTrips.findById.mockResolvedValue(fieldTrip({ status: 'AUTORIZADA' }));
    s.employees.findById.mockResolvedValue(buildEmployee({ fieldTripLateCount: 0 }));
    s.fieldTrips.transition.mockResolvedValue(fieldTrip({ status: 'CERRADA_NORMAL', lateMinutes: 30 }));
    const handler = new EvaluateFieldTripReturnHandler(s.access, s.fieldTrips, s.cascade, s.tm, s.audit, s.memos);
    const result = await handler.execute(returnCmd('2026-10-09T13:30:00Z'));
    expect(result.isLate).toBe(true);
    expect(result.lateCount).toBe(1);
    expect(result.isObserved).toBe(false);
    expect(result.fieldTrip.status).toBe('CERRADA_NORMAL');
  });

  it('EvaluateFieldTripReturn: la 4ª tardanza deja a la persona observada', async () => {
    const s = setup('ADMINISTRACION');
    s.fieldTrips.findById.mockResolvedValue(fieldTrip({ status: 'AUTORIZADA' }));
    s.employees.findById.mockResolvedValue(buildEmployee({ fieldTripLateCount: 3 }));
    s.fieldTrips.transition.mockResolvedValue(fieldTrip({ status: 'OBSERVADA', lateMinutes: 45 }));
    const handler = new EvaluateFieldTripReturnHandler(s.access, s.fieldTrips, s.cascade, s.tm, s.audit, s.memos);
    const result = await handler.execute(returnCmd('2026-10-09T13:45:00Z'));
    expect(result.lateCount).toBe(4);
    expect(result.isObserved).toBe(true);
    expect(s.employees.update).toHaveBeenCalledWith('emp-1', { fieldTripLateCount: 4, isFieldTripObserved: true }, s.tm.tx);
  });

  it('EvaluateFieldTripReturn: Campo no evalúa retornos', async () => {
    const s = setup('CAMPO');
    s.fieldTrips.findById.mockResolvedValue(fieldTrip({ status: 'AUTORIZADA' }));
    const handler = new EvaluateFieldTripReturnHandler(s.access, s.fieldTrips, s.cascade, s.tm, s.audit, s.memos);
    await expect(handler.execute(returnCmd('2026-10-09T13:45:00Z'))).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('TerminateEmploymentHandler (BR-ADP-006, BR-REC-008)', () => {
  const termination = (over: Partial<EmploymentTermination> = {}): EmploymentTermination => ({
    id: 'term-1',
    employeeId: 'emp-1',
    reason: 'RENUNCIA',
    noticeDays: 0,
    finalSettlementPaid: true,
    settlementAmount: new Prisma.Decimal(750),
    notes: null,
    terminatedById: UID,
    terminatedAt: new Date('2026-10-09T08:00:00Z'),
    createdAt: new Date('2026-10-09T08:00:00Z'),
    ...over,
  });
  const renuncia = () => new TerminateEmploymentCommand(UID, 'emp-1', 'RENUNCIA', 0, true, 750);

  it('solo Gerencia/RRHH desvinculan (Administración queda fuera)', async () => {
    const s = setup('ADMINISTRACION');
    s.employees.findById.mockResolvedValue(buildEmployee());
    const handler = new TerminateEmploymentHandler(s.access, s.employees, s.terminations, s.tm, s.clock, s.audit, s.outbox);
    await expect(handler.execute(renuncia())).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('renuncia sin previo aviso: termina de inmediato y publica RelacionLaboralTerminada.v1 en la misma transacción', async () => {
    const s = setup('GERENCIA');
    s.employees.findById.mockResolvedValue(buildEmployee());
    s.employees.markTerminated.mockResolvedValue(buildEmployee({ status: 'TERMINADO' }));
    s.terminations.create.mockResolvedValue(termination());
    const handler = new TerminateEmploymentHandler(s.access, s.employees, s.terminations, s.tm, s.clock, s.audit, s.outbox);
    const result = await handler.execute(renuncia());

    expect(result.employee.status).toBe('TERMINADO');
    expect(s.employees.markTerminated).toHaveBeenCalledWith(
      'emp-1',
      expect.objectContaining({ terminationReason: 'RENUNCIA', terminationNoticeDays: 0, terminatedAt: s.clock.now() }),
      s.tm.tx,
    );
    expect(s.outbox.publish).toHaveBeenCalledTimes(1);
    const [event, tx] = s.outbox.publish.mock.calls[0];
    expect(tx).toBe(s.tm.tx);
    expect(event).toMatchObject({
      aggregateType: 'Employee',
      aggregateId: 'emp-1',
      eventType: 'RelacionLaboralTerminada.v1',
      payload: expect.objectContaining({
        employeeId: 'emp-1',
        reason: 'RENUNCIA',
        areaId: 'OPERACIONES',
        jobTitle: 'Auxiliar de campo',
        operatingCompanyId: COMPANY_ID,
      }),
    });
    // El evento no filtra datos personales sensibles al otro módulo.
    expect(JSON.stringify(event.payload)).not.toContain('45678912');
    expect(JSON.stringify(event.payload)).not.toContain('Carlos Perez');
    expect(s.audit.recordHrAdministrationEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'EMPLOYMENT_TERMINATED', entityType: 'termination' }),
      s.tm.tx,
    );
  });

  it('despido por reincidencia: aviso de 15 días y motivo documentado', async () => {
    const s = setup('RRHH');
    s.employees.findById.mockResolvedValue(buildEmployee());
    s.employees.markTerminated.mockResolvedValue(buildEmployee({ status: 'TERMINADO' }));
    s.terminations.create.mockResolvedValue(termination({ reason: 'DESPIDO', noticeDays: 15 }));
    const handler = new TerminateEmploymentHandler(s.access, s.employees, s.terminations, s.tm, s.clock, s.audit, s.outbox);
    await handler.execute(new TerminateEmploymentCommand(UID, 'emp-1', 'DESPIDO', 15, false, 0, 'Reincidencia tras 3 llamadas de atención'));
    expect(s.terminations.create).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'DESPIDO', noticeDays: 15 }),
      s.tm.tx,
    );
  });

  it('despido sin motivo documentado y renuncia sin pago de la quincena se rechazan antes de tocar datos', async () => {
    const s = setup('RRHH');
    s.employees.findById.mockResolvedValue(buildEmployee());
    const handler = new TerminateEmploymentHandler(s.access, s.employees, s.terminations, s.tm, s.clock, s.audit, s.outbox);
    await expect(
      handler.execute(new TerminateEmploymentCommand(UID, 'emp-1', 'DESPIDO', 15, false, 0)),
    ).rejects.toBeInstanceOf(TerminationNotesRequiredError);
    await expect(
      handler.execute(new TerminateEmploymentCommand(UID, 'emp-1', 'RENUNCIA', 0, false, 0)),
    ).rejects.toBeInstanceOf(FinalSettlementRequiredError);
    expect(s.tm.run).not.toHaveBeenCalled();
    expect(s.outbox.publish).not.toHaveBeenCalled();
  });

  it('EMPLOYMENT_ALREADY_TERMINATED si ya estaba terminado; no emite un segundo evento', async () => {
    const s = setup('RRHH');
    s.employees.findById.mockResolvedValue(buildEmployee({ status: 'TERMINADO' }));
    const handler = new TerminateEmploymentHandler(s.access, s.employees, s.terminations, s.tm, s.clock, s.audit, s.outbox);
    await expect(handler.execute(renuncia())).rejects.toBeInstanceOf(EmploymentAlreadyTerminatedError);
    expect(s.outbox.publish).not.toHaveBeenCalled();
  });
});
