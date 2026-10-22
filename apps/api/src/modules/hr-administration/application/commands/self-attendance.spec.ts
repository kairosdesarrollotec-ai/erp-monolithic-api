import { ForbiddenException } from '@nestjs/common';
import type { AttendanceRecord } from '@prisma/client';
import {
  AttendanceAlreadyLoggedError,
  AttendanceCaptureTooOldError,
  AttendanceCheckInRequiredError,
  AttendanceEvidenceRequiredError,
  AttendanceLocationRequiredError,
  AttendanceMarkAlreadyLoggedError,
  AttendanceNotPendingReviewError,
  AttendanceRecordNotFoundError,
  AttendanceSelfStatusNotAllowedError,
  BranchNotFoundError,
  InvalidAttendanceReviewError,
  InvalidGeofenceError,
} from '../../domain/hr-administration-errors';
import {
  BRANCH_ID,
  COMPANY_ID,
  FixedClock,
  buildAudit,
  buildEmployee,
  buildMatrixAuth,
  buildTransactionManager,
  buildWorkContext,
} from '../../testing/hr-administration-test-fixtures';
import { HrAdministrationAccessService } from '../services/hr-administration-access.service';
import type { AttendanceRepositoryPort } from '../ports/attendance-repository.port';
import type { BranchGeofenceRepositoryPort } from '../ports/branch-geofence-repository.port';
import type { GetMyEmployeeHandler } from '../queries/get-my-employee.handler';
import { GetMyAttendanceHandler, ListAttendancePendingReviewHandler } from '../queries/my-attendance.handlers';
import { LogMyAttendanceHandler } from './log-my-attendance.handler';
import { ManageBranchGeofenceHandler } from './manage-branch-geofence.handler';
import { ReviewAttendanceHandler } from './review-attendance.handler';
import {
  BranchGeofenceRefCommand,
  LogMyAttendanceCommand,
  ReviewAttendanceCommand,
  SetBranchGeofenceCommand,
} from './self-attendance.commands';

const UID = 'uid-1';
const NOW = new Date('2026-10-22T15:00:00Z');
const SEDE = { latitude: -12.0464, longitude: -77.0428 };
const FENCE = {
  branchId: BRANCH_ID, branchName: 'Sede Lima', ...SEDE, radiusMeters: 100, updatedBy: null, updatedAt: null,
};
const PHOTO = {
  kind: 'SELF_PHOTO' as const,
  storageRef: `companies/${COMPANY_ID}/employees/emp-1/attendance/foto.jpg`,
  capturedAtLocal: new Date('2026-10-22T14:59:00Z'),
};

function record(over: Partial<AttendanceRecord> = {}): AttendanceRecord {
  return {
    id: 'att-1', employeeId: 'emp-1', date: new Date('2026-10-22T00:00:00Z'), status: 'PRESENTE', minutesLate: 0,
    deductionAmount: 0, isDeductionApplied: false, source: 'SELF', reviewStatus: null, checkOutCapturedAt: null,
    ...over,
  } as unknown as AttendanceRecord;
}

function attendanceMock() {
  return {
    findByEmployeeAndDate: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation(async (d: Record<string, unknown>) => record({ ...(d as object), id: 'att-new' } as Partial<AttendanceRecord>)),
    recordCheckOut: jest.fn().mockImplementation(async (id: string) => record({ id, checkOutCapturedAt: NOW })),
    findById: jest.fn(),
    review: jest.fn(),
    findPendingReview: jest.fn().mockResolvedValue([]),
    findManyByEmployee: jest.fn().mockResolvedValue([]),
  } as unknown as jest.Mocked<AttendanceRepositoryPort>;
}
function geofenceMock(fence: unknown = FENCE) {
  return {
    find: jest.fn().mockResolvedValue(fence),
    set: jest.fn().mockImplementation(async (_c: string, _b: string, d: Record<string, unknown>) => ({ ...FENCE, ...d, radiusMeters: d.radiusMeters })),
    clear: jest.fn().mockResolvedValue({ ...FENCE, latitude: null, longitude: null, radiusMeters: null }),
  } as unknown as jest.Mocked<BranchGeofenceRepositoryPort>;
}

describe('LogMyAttendanceHandler (#9)', () => {
  function build(role: 'CAMPO' | 'forbidden' = 'CAMPO', fence: unknown = FENCE) {
    const wc = buildWorkContext(role);
    const access = new HrAdministrationAccessService(wc, buildMatrixAuth());
    const attendance = attendanceMock();
    const geofences = geofenceMock(fence);
    const tm = buildTransactionManager();
    const audit = buildAudit();
    const myEmployee = { execute: jest.fn().mockResolvedValue(buildEmployee({ firebaseUid: UID })) } as unknown as jest.Mocked<GetMyEmployeeHandler>;
    const handler = new LogMyAttendanceHandler(access, myEmployee, attendance, geofences, tm, audit, new FixedClock(NOW));
    return { handler, attendance, audit, tm, myEmployee };
  }
  const here = { latitude: SEDE.latitude + 0.0002, longitude: SEDE.longitude, accuracy: 6 };
  const away = { latitude: SEDE.latitude + 0.01, longitude: SEDE.longitude, accuracy: 6 };
  const cmd = (over: Partial<{ type: 'CHECK_IN' | 'CHECK_OUT'; status: string; at: Date; loc: object; evidence: unknown; minutesLate: number }> = {}) =>
    new LogMyAttendanceCommand(
      UID, COMPANY_ID, BRANCH_ID, over.type ?? 'CHECK_IN', over.status ?? 'PRESENTE', over.minutesLate,
      over.at ?? new Date('2026-10-22T14:55:00Z'), (over.loc ?? here) as never, null,
      (over.evidence === undefined ? PHOTO : over.evidence) as never,
    );

  it('entrada dentro de la geocerca: se crea SELF sin revision y se audita', async () => {
    const b = build();
    const r = await b.handler.execute(cmd());
    expect(r.requiresReview).toBe(false);
    const data = b.attendance.create.mock.calls[0][0];
    expect(data).toMatchObject({ source: 'SELF', outsideGeofence: false, reviewStatus: null, geofenceRadiusMeters: 100 });
    expect(data.date.toISOString()).toBe('2026-10-22T00:00:00.000Z');
    expect(data.evidence).toMatchObject({ kind: 'SELF_PHOTO', corroboratedById: UID });
    expect(b.audit.recordHrAdministrationEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ATTENDANCE_SELF_LOGGED' }), b.tm.tx,
    );
  });

  it('entrada fuera de la geocerca: se guarda en revision PENDING (no se rechaza)', async () => {
    const b = build();
    const r = await b.handler.execute(cmd({ loc: away }));
    expect(r.requiresReview).toBe(true);
    expect(b.attendance.create.mock.calls[0][0]).toMatchObject({ outsideGeofence: true, reviewStatus: 'PENDING' });
  });

  it('sede sin geocerca configurada: se acepta sin evaluar', async () => {
    const b = build('CAMPO', null);
    await b.handler.execute(cmd({ loc: away }));
    expect(b.attendance.create.mock.calls[0][0]).toMatchObject({ outsideGeofence: false, distanceMeters: null, reviewStatus: null });
  });

  it('exige foto en la entrada, ubicacion completa y estado PRESENTE/TARDANZA', async () => {
    const b = build();
    await expect(b.handler.execute(cmd({ evidence: null }))).rejects.toBeInstanceOf(AttendanceEvidenceRequiredError);
    await expect(b.handler.execute(cmd({ loc: { latitude: 1, longitude: 1 } }))).rejects.toBeInstanceOf(AttendanceLocationRequiredError);
    await expect(b.handler.execute(cmd({ status: 'FALTA_INJUSTIFICADA' }))).rejects.toBeInstanceOf(AttendanceSelfStatusNotAllowedError);
    expect(b.attendance.create).not.toHaveBeenCalled();
  });

  it('rechaza una hora capturada de mas de 24 h y acepta una marca offline reciente', async () => {
    const b = build();
    await expect(b.handler.execute(cmd({ at: new Date('2026-10-21T14:00:00Z') }))).rejects.toBeInstanceOf(AttendanceCaptureTooOldError);
    await expect(b.handler.execute(cmd({ at: new Date('2026-10-22T03:00:00Z') }))).resolves.toBeDefined();
  });

  it('el dia es el de Lima de capturedAt (03:00Z del 22 es el 21 en Lima)', async () => {
    const b = build();
    await b.handler.execute(cmd({ at: new Date('2026-10-22T03:00:00Z') }));
    expect(b.attendance.create.mock.calls[0][0].date.toISOString()).toBe('2026-10-21T00:00:00.000Z');
  });

  it('tardanza exige minutos y calcula el descuento', async () => {
    const b = build();
    await expect(b.handler.execute(cmd({ status: 'TARDANZA' }))).rejects.toThrow();
    await b.handler.execute(cmd({ status: 'TARDANZA', minutesLate: 15 }));
    expect(b.attendance.create.mock.calls[0][0]).toMatchObject({ status: 'TARDANZA', minutesLate: 15 });
  });

  it('una sola entrada por dia: 409', async () => {
    const b = build();
    b.attendance.findByEmployeeAndDate.mockResolvedValue(record());
    await expect(b.handler.execute(cmd())).rejects.toBeInstanceOf(AttendanceAlreadyLoggedError);
  });

  it('salida: requiere entrada propia, una sola salida y guarda su ubicacion', async () => {
    const b = build();
    await expect(b.handler.execute(cmd({ type: 'CHECK_OUT', evidence: null }))).rejects.toBeInstanceOf(AttendanceCheckInRequiredError);
    b.attendance.findByEmployeeAndDate.mockResolvedValue(record({ source: 'ON_BEHALF' }));
    await expect(b.handler.execute(cmd({ type: 'CHECK_OUT', evidence: null }))).rejects.toBeInstanceOf(AttendanceCheckInRequiredError);
    b.attendance.findByEmployeeAndDate.mockResolvedValue(record({ checkOutCapturedAt: NOW }));
    await expect(b.handler.execute(cmd({ type: 'CHECK_OUT', evidence: null }))).rejects.toBeInstanceOf(AttendanceMarkAlreadyLoggedError);
    b.attendance.findByEmployeeAndDate.mockResolvedValue(record());
    await b.handler.execute(cmd({ type: 'CHECK_OUT', evidence: null, loc: away }));
    expect(b.attendance.recordCheckOut).toHaveBeenCalledWith(
      'att-1', expect.objectContaining({ outsideGeofence: true, latitude: away.latitude }), b.tm.tx,
    );
  });

  it('403 sin asignacion vigente o sin permiso LOG_OWN_ATTENDANCE', async () => {
    await expect(build('forbidden').handler.execute(cmd())).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('colaborador terminado no puede marcar', async () => {
    const b = build();
    b.myEmployee.execute.mockResolvedValue(buildEmployee({ firebaseUid: UID, status: 'TERMINADO' }));
    await expect(b.handler.execute(cmd())).rejects.toThrow();
  });
});

describe('ReviewAttendanceHandler (#9)', () => {
  function build(role: 'GERENCIA' | 'CAMPO' = 'GERENCIA') {
    const wc = buildWorkContext(role);
    const access = new HrAdministrationAccessService(wc, buildMatrixAuth());
    const attendance = attendanceMock();
    const tm = buildTransactionManager();
    const audit = buildAudit();
    const emp = { fullName: 'Carlos Perez', organizationId: 'o', operatingCompanyId: COMPANY_ID, branchId: BRANCH_ID, baseSalary: null };
    attendance.findById.mockResolvedValue({ ...record({ reviewStatus: 'PENDING', status: 'TARDANZA', minutesLate: 20 }), employee: emp } as never);
    attendance.review.mockImplementation(async (id: string, d) => record({ id, reviewStatus: d.reviewStatus, status: d.status ?? 'TARDANZA' }));
    return { handler: new ReviewAttendanceHandler(access, attendance, tm, new FixedClock(NOW), audit), attendance, audit, tm, emp };
  }

  it('APPROVE deja la marca tal cual y audita', async () => {
    const b = build();
    const r = await b.handler.execute(new ReviewAttendanceCommand(UID, 'att-1', 'APPROVE', 'ok'));
    expect(b.attendance.review).toHaveBeenCalledWith('att-1', expect.objectContaining({ reviewStatus: 'APPROVED', reviewNote: 'ok' }), b.tm.tx);
    expect(r.record.reviewStatus).toBe('APPROVED');
    expect(b.audit.recordHrAdministrationEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ATTENDANCE_REVIEWED' }), b.tm.tx,
    );
  });

  it('CORRECT exige nota y al menos un cambio real; recalcula y deja CORRECTED', async () => {
    const b = build();
    await expect(b.handler.execute(new ReviewAttendanceCommand(UID, 'att-1', 'CORRECT'))).rejects.toBeInstanceOf(InvalidAttendanceReviewError);
    await expect(b.handler.execute(new ReviewAttendanceCommand(UID, 'att-1', 'CORRECT', 'n'))).rejects.toBeInstanceOf(InvalidAttendanceReviewError);
    await expect(b.handler.execute(new ReviewAttendanceCommand(UID, 'att-1', 'CORRECT', 'n', 'TARDANZA', 20))).rejects.toBeInstanceOf(InvalidAttendanceReviewError);
    await b.handler.execute(new ReviewAttendanceCommand(UID, 'att-1', 'CORRECT', 'Llego a tiempo', 'PRESENTE'));
    expect(b.attendance.review).toHaveBeenCalledWith(
      'att-1', expect.objectContaining({ reviewStatus: 'CORRECTED', status: 'PRESENTE', minutesLate: 0, deductionAmount: 0 }), b.tm.tx,
    );
  });

  it('409 si no esta pendiente o el descuento ya se aplico; 404 si no existe; 403 sin permiso', async () => {
    const b = build();
    b.attendance.findById.mockResolvedValue({ ...record({ reviewStatus: 'APPROVED' }), employee: b.emp } as never);
    await expect(b.handler.execute(new ReviewAttendanceCommand(UID, 'att-1', 'APPROVE'))).rejects.toBeInstanceOf(AttendanceNotPendingReviewError);
    b.attendance.findById.mockResolvedValue(null);
    await expect(b.handler.execute(new ReviewAttendanceCommand(UID, 'x', 'APPROVE'))).rejects.toBeInstanceOf(AttendanceRecordNotFoundError);
    await expect(build('CAMPO').handler.execute(new ReviewAttendanceCommand(UID, 'att-1', 'APPROVE'))).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('ManageBranchGeofenceHandler (#9)', () => {
  function build(role: 'GERENCIA' | 'ADMINISTRACION' | 'RRHH' = 'GERENCIA', fence: unknown = FENCE) {
    const wc = buildWorkContext(role);
    const access = new HrAdministrationAccessService(wc, buildMatrixAuth());
    const geofences = geofenceMock(fence);
    const audit = buildAudit();
    return { handler: new ManageBranchGeofenceHandler(access, geofences, new FixedClock(NOW), audit), geofences, audit };
  }
  const set = (radius = 120, lat = SEDE.latitude) => new SetBranchGeofenceCommand(UID, COMPANY_ID, BRANCH_ID, lat, SEDE.longitude, radius);

  it('Gerencia y Administracion configuran; RRHH no (403)', async () => {
    await expect(build('GERENCIA').handler.set(set())).resolves.toMatchObject({ radiusMeters: 120 });
    await expect(build('ADMINISTRACION').handler.set(set())).resolves.toBeDefined();
    await expect(build('RRHH').handler.set(set())).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('valida el radio y las coordenadas (422) y la sede (404)', async () => {
    await expect(build().handler.set(set(5))).rejects.toBeInstanceOf(InvalidGeofenceError);
    await expect(build().handler.set(set(100, 95))).rejects.toBeInstanceOf(InvalidGeofenceError);
    await expect(build('GERENCIA', null).handler.set(set())).rejects.toBeInstanceOf(BranchNotFoundError);
    await expect(build('GERENCIA', null).handler.get(new BranchGeofenceRefCommand(UID, COMPANY_ID, BRANCH_ID))).rejects.toBeInstanceOf(BranchNotFoundError);
  });

  it('audita set y clear', async () => {
    const b = build();
    await b.handler.set(set());
    await b.handler.clear(new BranchGeofenceRefCommand(UID, COMPANY_ID, BRANCH_ID));
    const actions = b.audit.recordHrAdministrationEvent.mock.calls.map((c) => c[0].action);
    expect(actions).toEqual(['BRANCH_GEOFENCE_SET', 'BRANCH_GEOFENCE_CLEARED']);
  });
});

describe('consultas de asistencia propia y bandeja de revision (#9)', () => {
  it('GetMyAttendance devuelve marcas del mes y la geocerca (configurada o no)', async () => {
    const wc = buildWorkContext('CAMPO');
    const access = new HrAdministrationAccessService(wc, buildMatrixAuth());
    const attendance = attendanceMock();
    const myEmployee = { execute: jest.fn().mockResolvedValue(buildEmployee()) } as unknown as jest.Mocked<GetMyEmployeeHandler>;
    const h = new GetMyAttendanceHandler(access, myEmployee, attendance, geofenceMock());
    const r = await h.execute({ firebaseUid: UID, companyId: COMPANY_ID, branchId: BRANCH_ID, month: '2026-10' });
    expect(attendance.findManyByEmployee).toHaveBeenCalledWith('emp-1', { month: '2026-10' });
    expect(r.geofence).toEqual({ configured: true, latitude: SEDE.latitude, longitude: SEDE.longitude, radiusMeters: 100 });
    const none = await new GetMyAttendanceHandler(access, myEmployee, attendance, geofenceMock(null)).execute({
      firebaseUid: UID, companyId: COMPANY_ID, branchId: BRANCH_ID,
    });
    expect(none.geofence.configured).toBe(false);
  });

  it('la bandeja pendiente requiere REVIEW_ATTENDANCE y limita a 200', async () => {
    const attendance = attendanceMock();
    const ok = new ListAttendancePendingReviewHandler(new HrAdministrationAccessService(buildWorkContext('ADMINISTRACION'), buildMatrixAuth()), attendance);
    await ok.execute({ firebaseUid: UID, companyId: COMPANY_ID, branchId: BRANCH_ID, limit: 9999 });
    expect(attendance.findPendingReview).toHaveBeenCalledWith(COMPANY_ID, 200);
    const denied = new ListAttendancePendingReviewHandler(new HrAdministrationAccessService(buildWorkContext('CAMPO'), buildMatrixAuth()), attendance);
    await expect(denied.execute({ firebaseUid: UID, companyId: COMPANY_ID, branchId: BRANCH_ID })).rejects.toBeInstanceOf(ForbiddenException);
  });
});
