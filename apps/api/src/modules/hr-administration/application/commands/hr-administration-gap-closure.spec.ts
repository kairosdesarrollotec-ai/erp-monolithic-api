import { ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AttendanceRecord, FieldTripRequest } from '@prisma/client';
import {
  AttendanceNotReclassifiableError,
  AttendanceRecordNotFoundError,
  FieldTripNotPendingError,
  FieldTripRejectionReasonRequiredError,
  FieldTripSelfApprovalError,
  InvalidAttendanceReclassificationError,
  InvalidLeaveEvidenceError,
  InvalidTrainingError,
  LeaveEvidenceNotAllowedError,
  TrainingAttendeesInvalidError,
} from '../../domain/hr-administration-errors';
import { nextLevelTimeoutAfter, resolveReclassification } from '../../domain/hr-administration-rules';
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
  buildTransactionManager,
  buildTripEmployee,
  buildWorkContext,
} from '../../testing/hr-administration-test-fixtures';
import { HrAdministrationAccessService } from '../services/hr-administration-access.service';
import { FieldTripCascadeService } from '../services/field-trip-cascade.service';
import { HrMemoService, SYSTEM_MEMO_ACTOR } from '../services/hr-memo.service';
import { FieldTripAlertPublisher } from '../services/field-trip-alert.publisher';
import type { AttendanceRepositoryPort } from '../ports/attendance-repository.port';
import type { EmployeeRepositoryPort } from '../ports/employee-repository.port';
import type { FieldTripRepositoryPort, FieldTripWithEmployee } from '../ports/field-trip-repository.port';
import type { LeaveRepositoryPort } from '../ports/leave-repository.port';
import type { LeaveEvidenceStoragePort } from '../ports/leave-evidence-storage.port';
import type { TrainingRepositoryPort } from '../ports/training-repository.port';
import type { UserAccountEmailPort } from '../ports/user-account-email.port';
import { FieldTripCascadeScheduler } from '../../infrastructure/scheduling/field-trip-cascade.scheduler';
import { RejectFieldTripCommand } from './reject-field-trip.command';
import { RejectFieldTripHandler } from './reject-field-trip.handler';
import {
  FIELD_TRIP_SCHEDULER_ACTOR,
  ProcessDueFieldTripTimeoutsHandler,
} from './process-due-field-trip-timeouts.handler';
import { ReclassifyAttendanceCommand } from './reclassify-attendance.command';
import { ReclassifyAttendanceHandler } from './reclassify-attendance.handler';
import { RequestLeaveEvidenceUploadSessionCommand } from './request-leave-evidence-upload-session.command';
import { RequestLeaveEvidenceUploadSessionHandler } from './request-leave-evidence-upload-session.handler';
import { RecordLeaveEvidenceCommand } from './record-leave-evidence.command';
import { RecordLeaveEvidenceHandler } from './record-leave-evidence.handler';
import { RegisterTrainingCommand } from './register-training.command';
import { RegisterTrainingHandler } from './register-training.handler';
import { GetMyEmployeeHandler } from '../queries/get-my-employee.handler';
import { GetMyEmployeeQuery } from '../queries/get-my-employee.query';
import { GetFieldTripHandler } from '../queries/get-field-trip.handler';
import { GetFieldTripQuery } from '../queries/get-field-trip.query';
import { EmployeeNotLinkedError } from '../../domain/hr-administration-errors';

const UID = 'uid-1';
type Role = 'RRHH' | 'GERENCIA' | 'ADMINISTRACION' | 'AUDITORIA' | 'CAMPO';

function fieldTrip(over: Partial<FieldTripWithEmployee> = {}): FieldTripWithEmployee {
  return {
    id: 'ft-1', employeeId: 'emp-1', destination: 'Sede Norte', objective: 'Entrega',
    estimatedDeparture: new Date('2026-10-09T09:00:00Z'), estimatedReturn: new Date('2026-10-09T13:00:00Z'),
    actualDeparture: null, actualReturn: null, status: 'PENDIENTE_NIVEL_2', authorizationLevel: null,
    authorizedById: null, authorizedByName: null, authorizedAt: null, lateMinutes: 0, returnNotes: null,
    rejectedById: null, rejectedByName: null, rejectedAt: null, rejectedAtLevel: null, rejectionReason: null,
    level1TimeoutAt: new Date('2026-10-09T08:05:00Z'), level2TimeoutAt: new Date('2026-10-09T08:10:00Z'),
    level3TimeoutAt: null, createdAt: new Date('2026-10-09T08:00:00Z'), updatedAt: new Date('2026-10-09T08:00:00Z'),
    employee: buildTripEmployee(),
    ...over,
  };
}

function setup(role: Role = 'RRHH') {
  const access = new HrAdministrationAccessService(buildWorkContext(role), buildMatrixAuth());
  const tm = buildTransactionManager();
  const clock = new FixedClock();
  const audit = buildAudit();
  const displayNames = buildDisplayNames();
  const employees = {
    findById: jest.fn(), findManyByIds: jest.fn(), findByFirebaseUid: jest.fn(),
    findActiveByEmail: jest.fn(), linkFirebaseUid: jest.fn(), update: jest.fn(),
  } as unknown as jest.Mocked<EmployeeRepositoryPort>;
  const attendance = {
    findById: jest.fn(), reclassify: jest.fn(), countInMonthOf: jest.fn().mockResolvedValue(2),
  } as unknown as jest.Mocked<AttendanceRepositoryPort>;
  const fieldTrips = {
    findById: jest.fn(), findMany: jest.fn(), transition: jest.fn(), claimNextDueForEscalation: jest.fn(),
  } as unknown as jest.Mocked<FieldTripRepositoryPort>;
  const leaves = {
    findById: jest.fn(), countEvidence: jest.fn().mockResolvedValue(0), addEvidence: jest.fn(), listEvidence: jest.fn(),
  } as unknown as jest.Mocked<LeaveRepositoryPort>;
  const trainings = { create: jest.fn(), findMany: jest.fn(), findByEmployee: jest.fn() } as unknown as jest.Mocked<TrainingRepositoryPort>;
  const cascade = new FieldTripCascadeService(fieldTrips, employees);
  const memoRepo = buildMemoRepo();
  const memos = new HrMemoService(memoRepo, attendance, audit);
  const alerts = { publish: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<FieldTripAlertPublisher>;
  return { alerts, access, tm, clock, audit, displayNames, employees, attendance, fieldTrips, leaves, trainings, cascade, memoRepo, memos };
}

describe('reglas ADP de cierre de huecos', () => {
  it('nextLevelTimeoutAfter cuenta 5 min desde el vencimiento anterior, no desde el momento de la detección', () => {
    const prev = new Date('2026-10-09T08:05:00Z');
    expect(nextLevelTimeoutAfter(prev, new Date('2026-10-09T08:07:30Z'))).toEqual(new Date('2026-10-09T08:10:00Z'));
    expect(nextLevelTimeoutAfter(null, new Date('2026-10-09T08:07:00Z'))).toEqual(new Date('2026-10-09T08:12:00Z'));
  });

  it('resolveReclassification: injustificada descuenta, justificada no, y exige justificación', () => {
    const base = { currentStatus: 'FALTA_JUSTIFICADA', isDeductionApplied: false, baseSalary: 3000 };
    const toUn = resolveReclassification({ ...base, targetStatus: 'FALTA_INJUSTIFICADA', justification: 'No avisó' });
    expect(toUn.status).toBe('FALTA_INJUSTIFICADA');
    expect(toUn.deductionAmount).toBeGreaterThan(0);
    const toJus = resolveReclassification({
      currentStatus: 'FALTA_INJUSTIFICADA', isDeductionApplied: false, targetStatus: 'FALTA_JUSTIFICADA',
      justification: 'Certificado médico', baseSalary: 3000,
    });
    expect(toJus.deductionAmount).toBe(0);
    expect(() => resolveReclassification({ ...base, targetStatus: 'FALTA_INJUSTIFICADA', justification: ' ' })).toThrow(
      InvalidAttendanceReclassificationError,
    );
    expect(() =>
      resolveReclassification({ ...base, isDeductionApplied: true, targetStatus: 'FALTA_INJUSTIFICADA', justification: 'motivo ok' }),
    ).toThrow(AttendanceNotReclassifiableError);
    expect(() => resolveReclassification({ ...base, currentStatus: 'PRESENTE', targetStatus: 'FALTA_INJUSTIFICADA', justification: 'motivo ok' })).toThrow(
      AttendanceNotReclassifiableError,
    );
  });
});

describe('HrMemoService (BR-ADP-005 / ADP-P03)', () => {
  const lateInput = (newLateCount: number) => ({
    organizationId: ORG_ID, employeeId: 'emp-1', fieldTripId: 'ft-1', destination: 'Sede Norte',
    newLateCount, lateMinutes: 45, issuedOn: new Date('2026-10-09T00:00:00Z'),
  });

  it('1ª a 3ª tardanza son advertencia: no se genera memo', async () => {
    const s = setup();
    for (const n of [1, 2, 3]) {
      expect(await s.memos.onFieldTripLateReturn(lateInput(n), s.tm.tx)).toBeNull();
    }
    expect(s.memoRepo.createIfAbsent).not.toHaveBeenCalled();
  });

  it('la 4ª tardanza genera el memo automáticamente y deja evento de auditoría del sistema', async () => {
    const s = setup();
    const memo = await s.memos.onFieldTripLateReturn(lateInput(4), s.tm.tx);
    expect(memo).not.toBeNull();
    expect(s.memoRepo.createIfAbsent).toHaveBeenCalledWith(
      expect.objectContaining({ employeeId: 'emp-1', sourceId: 'ft-1', violationNumber: 4 }),
      s.tm.tx,
    );
    expect(s.audit.recordHrAdministrationEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'MEMO_GENERATED', actorUserId: SYSTEM_MEMO_ACTOR, entityType: 'memo' }),
      s.tm.tx,
    );
  });

  it('es idempotente: si el memo ya existía no se audita otra vez', async () => {
    const s = setup();
    s.memoRepo.createIfAbsent.mockResolvedValue({ memo: { id: 'memo-1', employeeId: 'emp-1' } as never, created: false });
    await s.memos.onFieldTripLateReturn(lateInput(4), s.tm.tx);
    expect(s.audit.recordHrAdministrationEvent).not.toHaveBeenCalled();
  });

  it('la 2ª falta injustificada del mes genera memo; la 1ª no', async () => {
    const s = setup();
    const input = { organizationId: ORG_ID, employeeId: 'emp-1', attendanceId: 'att-1', date: new Date('2026-10-08T00:00:00Z') };
    s.attendance.countInMonthOf.mockResolvedValueOnce(1);
    expect(await s.memos.onUnjustifiedAbsence(input, s.tm.tx)).toBeNull();
    s.attendance.countInMonthOf.mockResolvedValueOnce(2);
    expect(await s.memos.onUnjustifiedAbsence(input, s.tm.tx)).not.toBeNull();
  });
});

describe('RejectFieldTripHandler (ADP-07)', () => {
  const build = (s: ReturnType<typeof setup>) =>
    new RejectFieldTripHandler(s.access, s.fieldTrips, s.cascade, s.displayNames, s.tm, s.clock, s.audit, s.alerts, s.employees);

  it('no deja que el solicitante rechace su propia salida a campo', async () => {
    const s = setup('RRHH');
    s.fieldTrips.findById.mockResolvedValue(fieldTrip());
    s.employees.findByFirebaseUid.mockResolvedValue(buildEmployee({ id: 'emp-1', firebaseUid: UID }));
    await expect(build(s).execute(new RejectFieldTripCommand(UID, 'ft-1', 'No corresponde'))).rejects.toBeInstanceOf(
      FieldTripSelfApprovalError,
    );
    expect(s.fieldTrips.transition).not.toHaveBeenCalled();
  });

  it('rechaza con motivo: NO_AUTORIZADA, nivel pendiente registrado y auditoría', async () => {
    const s = setup('RRHH');
    s.fieldTrips.findById.mockResolvedValue(fieldTrip());
    s.fieldTrips.transition.mockResolvedValue(
      fieldTrip({ status: 'NO_AUTORIZADA', rejectedAtLevel: 2, rejectionReason: 'Sin unidad disponible' }) as unknown as FieldTripRequest,
    );
    await build(s).execute(new RejectFieldTripCommand(UID, 'ft-1', ' Sin unidad disponible '));
    expect(s.fieldTrips.transition).toHaveBeenCalledWith(
      'ft-1',
      ['PENDIENTE_NIVEL_1', 'PENDIENTE_NIVEL_2', 'PENDIENTE_NIVEL_3'],
      expect.objectContaining({ status: 'NO_AUTORIZADA', rejectedAtLevel: 2, rejectionReason: 'Sin unidad disponible', rejectedById: UID }),
      s.tm.tx,
    );
    expect(s.audit.recordHrAdministrationEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'FIELD_TRIP_REJECTED' }),
      s.tm.tx,
    );
    expect(s.alerts.publish).toHaveBeenCalledWith('RESOLVED', expect.anything(), expect.anything(), s.tm.tx, { outcome: 'RECHAZADA' });
  });

  it('exige un motivo escrito', async () => {
    const s = setup('RRHH');
    await expect(build(s).execute(new RejectFieldTripCommand(UID, 'ft-1', '  '))).rejects.toBeInstanceOf(
      FieldTripRejectionReasonRequiredError,
    );
  });

  it('no rechaza una salida que ya no está pendiente', async () => {
    const s = setup('RRHH');
    s.fieldTrips.findById.mockResolvedValue(fieldTrip({ status: 'AUTORIZADA' }));
    await expect(build(s).execute(new RejectFieldTripCommand(UID, 'ft-1', 'motivo válido'))).rejects.toBeInstanceOf(
      FieldTripNotPendingError,
    );
  });

  it('un rol sin AUTHORIZE_FIELD_TRIP no puede rechazar', async () => {
    const s = setup('CAMPO');
    s.fieldTrips.findById.mockResolvedValue(fieldTrip());
    await expect(build(s).execute(new RejectFieldTripCommand(UID, 'ft-1', 'motivo válido'))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});

describe('ProcessDueFieldTripTimeoutsHandler y FieldTripCascadeScheduler (BR-ADP-004, NFR-BIZ-008)', () => {
  const build = (s: ReturnType<typeof setup>) =>
    new ProcessDueFieldTripTimeoutsHandler(s.fieldTrips, s.cascade, s.tm, s.clock, s.audit, s.alerts);

  it('sin salidas vencidas no hace nada', async () => {
    const s = setup();
    s.fieldTrips.claimNextDueForEscalation.mockResolvedValue(null);
    expect(await build(s).execute()).toEqual({ escalated: 0, notAuthorized: 0 });
    expect(s.audit.recordHrAdministrationEvent).not.toHaveBeenCalled();
  });

  it('escala una salida vencida con auditoría automática y vence el siguiente nivel 5 min después del anterior', async () => {
    const s = setup();
    s.clock.set(new Date('2026-10-09T08:06:00Z'));
    const level1 = fieldTrip({ status: 'PENDIENTE_NIVEL_1', level1TimeoutAt: new Date('2026-10-09T08:05:00Z'), level2TimeoutAt: null });
    s.fieldTrips.claimNextDueForEscalation.mockResolvedValueOnce('ft-1').mockResolvedValueOnce(null);
    s.fieldTrips.findById.mockResolvedValue(level1);
    s.fieldTrips.transition.mockResolvedValue(fieldTrip({ status: 'PENDIENTE_NIVEL_2' }));
    const result = await build(s).execute();
    expect(result).toEqual({ escalated: 1, notAuthorized: 0 });
    expect(s.fieldTrips.transition).toHaveBeenCalledWith(
      'ft-1',
      ['PENDIENTE_NIVEL_1'],
      { status: 'PENDIENTE_NIVEL_2', level2TimeoutAt: new Date('2026-10-09T08:10:00Z') },
      s.tm.tx,
    );
    expect(s.audit.recordHrAdministrationEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: FIELD_TRIP_SCHEDULER_ACTOR,
        action: 'FIELD_TRIP_ESCALATED',
        changes: expect.objectContaining({ automatic: true }),
      }),
      s.tm.tx,
    );
    expect(s.alerts.publish).toHaveBeenCalledWith('ESCALATED', expect.anything(), expect.anything(), s.tm.tx, expect.objectContaining({ automatic: true }));
  });

  it('tras vencer el nivel 3 queda NO_AUTORIZADA, nunca aprobada ni con 4º nivel', async () => {
    const s = setup();
    s.clock.set(new Date('2026-10-09T08:16:00Z'));
    s.fieldTrips.claimNextDueForEscalation.mockResolvedValueOnce('ft-1').mockResolvedValueOnce(null);
    s.fieldTrips.findById.mockResolvedValue(
      fieldTrip({ status: 'PENDIENTE_NIVEL_3', level3TimeoutAt: new Date('2026-10-09T08:15:00Z') }),
    );
    s.fieldTrips.transition.mockResolvedValue(fieldTrip({ status: 'NO_AUTORIZADA' }));
    const result = await build(s).execute();
    expect(result).toEqual({ escalated: 1, notAuthorized: 1 });
    expect(s.audit.recordHrAdministrationEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'FIELD_TRIP_NOT_AUTHORIZED' }),
      s.tm.tx,
    );
    expect(s.alerts.publish).toHaveBeenCalledWith('NOT_AUTHORIZED', expect.anything(), expect.anything(), s.tm.tx, expect.anything());
  });

  it('si otra operación la resolvió justo antes, la omite sin error ni escalación contada', async () => {
    const s = setup();
    s.fieldTrips.claimNextDueForEscalation.mockResolvedValueOnce('ft-1').mockResolvedValueOnce(null);
    s.fieldTrips.findById.mockResolvedValue(fieldTrip({ status: 'AUTORIZADA' }));
    expect(await build(s).execute()).toEqual({ escalated: 0, notAuthorized: 0 });
  });

  it('el programador no solapa ciclos y no propaga errores', async () => {
    let release: () => void = () => undefined;
    const execute = jest.fn().mockImplementation(() => new Promise<void>((r) => { release = r; }));
    const scheduler = new FieldTripCascadeScheduler({ execute } as unknown as ProcessDueFieldTripTimeoutsHandler);
    const first = scheduler.tick();
    await scheduler.tick();
    expect(execute).toHaveBeenCalledTimes(1);
    release();
    await first;

    execute.mockReset();
    execute.mockRejectedValueOnce(new Error('db caída')).mockResolvedValue(undefined);
    await expect(scheduler.tick()).resolves.toBeUndefined();
    await scheduler.tick();
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it('no arranca temporizador bajo Jest', () => {
    const scheduler = new FieldTripCascadeScheduler({ execute: jest.fn() } as unknown as ProcessDueFieldTripTimeoutsHandler);
    scheduler.onModuleInit();
    expect((scheduler as unknown as { timer?: unknown }).timer).toBeUndefined();
  });
});

describe('ReclassifyAttendanceHandler (ADP-03)', () => {
  const absence = (over: Partial<AttendanceRecord> = {}) => ({
    id: 'att-1', employeeId: 'emp-1', date: new Date('2026-10-08T00:00:00Z'), checkInTime: null, checkOutTime: null,
    status: 'FALTA_JUSTIFICADA', minutesLate: 0, deductionAmount: new Prisma.Decimal(0), isDeductionApplied: false,
    payrollMonth: null, deductionAppliedAt: null, notes: null, justification: 'Aviso', reclassifiedAt: null,
    reclassifiedById: null, createdById: UID, createdAt: new Date(), updatedAt: new Date(),
    employee: { ...buildEmployee(), baseSalary: new Prisma.Decimal(3000) },
    ...over,
  });
  const build = (s: ReturnType<typeof setup>) =>
    new ReclassifyAttendanceHandler(s.access, s.attendance, s.tm, s.clock, s.audit, s.memos);

  it('pasa a injustificada con descuento calculado, auditoría y memo si es la 2ª del mes', async () => {
    const s = setup('RRHH');
    s.attendance.findById.mockResolvedValue(absence() as never);
    s.attendance.reclassify.mockResolvedValue({ ...absence(), status: 'FALTA_INJUSTIFICADA', deductionAmount: new Prisma.Decimal(100) } as never);
    const result = await build(s).execute(new ReclassifyAttendanceCommand(UID, 'att-1', 'FALTA_INJUSTIFICADA', 'No presentó sustento'));
    expect(result.record.status).toBe('FALTA_INJUSTIFICADA');
    expect(result.memo).not.toBeNull();
    expect(s.audit.recordHrAdministrationEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ATTENDANCE_RECLASSIFIED' }),
      s.tm.tx,
    );
  });

  it('a justificada no genera memo', async () => {
    const s = setup('RRHH');
    s.attendance.findById.mockResolvedValue(absence({ status: 'FALTA_INJUSTIFICADA' }) as never);
    s.attendance.reclassify.mockResolvedValue(absence() as never);
    const result = await build(s).execute(new ReclassifyAttendanceCommand(UID, 'att-1', 'FALTA_JUSTIFICADA', 'Certificado médico'));
    expect(result.memo).toBeNull();
    expect(s.memoRepo.createIfAbsent).not.toHaveBeenCalled();
  });

  it('registro inexistente, descuento ya aplicado y cambio concurrente', async () => {
    const s = setup('RRHH');
    s.attendance.findById.mockResolvedValue(null);
    await expect(build(s).execute(new ReclassifyAttendanceCommand(UID, 'x', 'FALTA_INJUSTIFICADA', 'motivo ok'))).rejects.toBeInstanceOf(
      AttendanceRecordNotFoundError,
    );
    s.attendance.findById.mockResolvedValue(absence({ isDeductionApplied: true }) as never);
    await expect(build(s).execute(new ReclassifyAttendanceCommand(UID, 'att-1', 'FALTA_INJUSTIFICADA', 'motivo ok'))).rejects.toBeInstanceOf(
      AttendanceNotReclassifiableError,
    );
    s.attendance.findById.mockResolvedValue(absence() as never);
    s.attendance.reclassify.mockResolvedValue(null);
    await expect(build(s).execute(new ReclassifyAttendanceCommand(UID, 'att-1', 'FALTA_INJUSTIFICADA', 'motivo ok'))).rejects.toBeInstanceOf(
      AttendanceNotReclassifiableError,
    );
  });

  it('un rol sin LOG_ATTENDANCE no reclasifica', async () => {
    const s = setup('CAMPO');
    s.attendance.findById.mockResolvedValue(absence() as never);
    await expect(build(s).execute(new ReclassifyAttendanceCommand(UID, 'att-1', 'FALTA_INJUSTIFICADA', 'motivo ok'))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});

describe('Evidencia de permisos (ADP-04)', () => {
  const leave = (status = 'SOLICITADO') =>
    ({ id: 'leave-1', employeeId: 'emp-1', status, employee: buildTripEmployee() }) as never;
  const goodUrl = `https://storage.googleapis.com/bucket/companies/${COMPANY_ID}/leaves/leave-1/a.pdf`;

  it('emite la URL firmada para un permiso solicitado y tipo admitido', async () => {
    const s = setup('RRHH');
    s.leaves.findById.mockResolvedValue(leave());
    const storage = {
      generateSignedUploadUrl: jest.fn().mockResolvedValue({ uploadUrl: 'u', objectUrl: goodUrl, expiresAt: new Date() }),
    } as unknown as jest.Mocked<LeaveEvidenceStoragePort>;
    const handler = new RequestLeaveEvidenceUploadSessionHandler(s.access, s.leaves, storage);
    await handler.execute(new RequestLeaveEvidenceUploadSessionCommand(UID, 'leave-1', 'application/pdf', 1000));
    expect(storage.generateSignedUploadUrl).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: COMPANY_ID, leaveId: 'leave-1', contentType: 'application/pdf' }),
    );
  });

  it('rechaza tipo no admitido, archivo grande, permiso ya resuelto y exceso de archivos', async () => {
    const s = setup('RRHH');
    const storage = { generateSignedUploadUrl: jest.fn() } as unknown as jest.Mocked<LeaveEvidenceStoragePort>;
    const handler = new RequestLeaveEvidenceUploadSessionHandler(s.access, s.leaves, storage);
    s.leaves.findById.mockResolvedValue(leave());
    await expect(handler.execute(new RequestLeaveEvidenceUploadSessionCommand(UID, 'leave-1', 'text/html', 10))).rejects.toBeInstanceOf(InvalidLeaveEvidenceError);
    await expect(handler.execute(new RequestLeaveEvidenceUploadSessionCommand(UID, 'leave-1', 'application/pdf', 50 * 1024 * 1024))).rejects.toBeInstanceOf(InvalidLeaveEvidenceError);
    s.leaves.countEvidence.mockResolvedValue(5);
    await expect(handler.execute(new RequestLeaveEvidenceUploadSessionCommand(UID, 'leave-1', 'application/pdf', 10))).rejects.toBeInstanceOf(InvalidLeaveEvidenceError);
    s.leaves.findById.mockResolvedValue(leave('AUTORIZADO'));
    s.leaves.countEvidence.mockResolvedValue(0);
    await expect(handler.execute(new RequestLeaveEvidenceUploadSessionCommand(UID, 'leave-1', 'application/pdf', 10))).rejects.toBeInstanceOf(LeaveEvidenceNotAllowedError);
    expect(storage.generateSignedUploadUrl).not.toHaveBeenCalled();
  });

  it('registra la evidencia solo si la URL pertenece a este permiso y empresa, y audita', async () => {
    const s = setup('RRHH');
    s.leaves.findById.mockResolvedValue(leave());
    s.leaves.addEvidence.mockResolvedValue({ id: 'ev-1', contentType: 'application/pdf' } as never);
    const handler = new RecordLeaveEvidenceHandler(s.access, s.leaves, s.tm, s.audit);
    await handler.execute(new RecordLeaveEvidenceCommand(UID, 'leave-1', goodUrl, 'application/pdf'));
    expect(s.audit.recordHrAdministrationEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'LEAVE_EVIDENCE_ATTACHED' }),
      s.tm.tx,
    );
    const foreign = 'https://storage.googleapis.com/bucket/companies/otra-empresa/leaves/leave-1/a.pdf';
    await expect(handler.execute(new RecordLeaveEvidenceCommand(UID, 'leave-1', foreign, 'application/pdf'))).rejects.toBeInstanceOf(InvalidLeaveEvidenceError);
    await expect(handler.execute(new RecordLeaveEvidenceCommand(UID, 'leave-1', 'https://evil.example/x.pdf', 'application/pdf'))).rejects.toBeInstanceOf(InvalidLeaveEvidenceError);
  });
});

describe('RegisterTrainingHandler (ADP-10, BR-ADP-008)', () => {
  const build = (s: ReturnType<typeof setup>) =>
    new RegisterTrainingHandler(s.access, s.employees, s.trainings, s.tm, s.clock, s.audit);
  const cmd = (over: Partial<{ topic: string; attendeeIds: string[]; heldOn: Date; duration: number }> = {}) =>
    new RegisterTrainingCommand(
      UID, COMPANY_ID, BRANCH_ID, over.topic ?? 'Manejo defensivo',
      over.heldOn ?? new Date('2026-10-08T00:00:00Z'), over.attendeeIds ?? ['emp-1', 'emp-2'], over.duration, ' buena comprensión ',
    );

  it('registra el taller con asistentes válidos y audita', async () => {
    const s = setup('RRHH');
    s.employees.findManyByIds.mockResolvedValue([buildEmployee({ id: 'emp-1' }), buildEmployee({ id: 'emp-2' })]);
    s.trainings.create.mockResolvedValue({ id: 'tr-1', topic: 'Manejo defensivo', heldOn: new Date(), attendees: [] } as never);
    await build(s).execute(cmd());
    expect(s.trainings.create).toHaveBeenCalledWith(
      expect.objectContaining({ topic: 'Manejo defensivo', durationMinutes: 60, comprehensionNotes: 'buena comprensión', attendeeIds: ['emp-1', 'emp-2'] }),
      s.tm.tx,
    );
    expect(s.audit.recordHrAdministrationEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'TRAINING_REGISTERED' }), s.tm.tx);
  });

  it('valida tema, asistentes, fecha futura y pertenencia a la empresa', async () => {
    const s = setup('RRHH');
    await expect(build(s).execute(cmd({ topic: '  ' }))).rejects.toBeInstanceOf(InvalidTrainingError);
    await expect(build(s).execute(cmd({ attendeeIds: [] }))).rejects.toBeInstanceOf(TrainingAttendeesInvalidError);
    await expect(build(s).execute(cmd({ heldOn: new Date('2026-12-01T00:00:00Z') }))).rejects.toBeInstanceOf(InvalidTrainingError);
    s.employees.findManyByIds.mockResolvedValue([buildEmployee({ id: 'emp-1' }), buildEmployee({ id: 'emp-2', operatingCompanyId: 'otra' })]);
    await expect(build(s).execute(cmd())).rejects.toBeInstanceOf(TrainingAttendeesInvalidError);
    expect(s.trainings.create).not.toHaveBeenCalled();
  });

  it('solo Gerencia y RRHH registran capacitaciones', async () => {
    const s = setup('ADMINISTRACION');
    await expect(build(s).execute(cmd())).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('GetMyEmployeeHandler (ADP-06)', () => {
  const build = (s: ReturnType<typeof setup>, email: string | null = 'carlos@kairos.pe') => {
    const accountEmail = { findEmail: jest.fn().mockResolvedValue(email) } as unknown as jest.Mocked<UserAccountEmailPort>;
    const workContext = buildWorkContext('CAMPO');
    return { handler: new GetMyEmployeeHandler(workContext, s.employees, accountEmail), accountEmail };
  };
  const q = new GetMyEmployeeQuery(UID, COMPANY_ID, BRANCH_ID);

  it('devuelve la ficha ya vinculada a la cuenta, sin exigir permisos de Personal', async () => {
    const s = setup();
    s.employees.findByFirebaseUid.mockResolvedValue(buildEmployee({ firebaseUid: UID }));
    const { handler } = build(s);
    expect((await handler.execute(q)).id).toBe('emp-1');
  });

  it('sin vínculo, la única ficha vigente con su correo queda vinculada', async () => {
    const s = setup();
    s.employees.findByFirebaseUid.mockResolvedValue(null);
    s.employees.findActiveByEmail.mockResolvedValue([buildEmployee()]);
    s.employees.linkFirebaseUid.mockResolvedValue(buildEmployee({ firebaseUid: UID }));
    const { handler } = build(s);
    await handler.execute(q);
    expect(s.employees.linkFirebaseUid).toHaveBeenCalledWith('emp-1', UID);
  });

  it('no adivina: 0 o 2 coincidencias o sin correo dan EMPLOYEE_NOT_LINKED', async () => {
    const s = setup();
    s.employees.findByFirebaseUid.mockResolvedValue(null);
    s.employees.findActiveByEmail.mockResolvedValue([]);
    await expect(build(s).handler.execute(q)).rejects.toBeInstanceOf(EmployeeNotLinkedError);
    s.employees.findActiveByEmail.mockResolvedValue([buildEmployee({ id: 'a' }), buildEmployee({ id: 'b' })]);
    await expect(build(s).handler.execute(q)).rejects.toBeInstanceOf(EmployeeNotLinkedError);
    await expect(build(s, null).handler.execute(q)).rejects.toBeInstanceOf(EmployeeNotLinkedError);
    expect(s.employees.linkFirebaseUid).not.toHaveBeenCalled();
  });
});

describe('Rol solo con EVALUATE_FIELD_TRIP_RETURN (hueco 11)', () => {
  it('puede leer la salida con el colaborador evaluado sin VIEW_EMPLOYEES completo', async () => {
    const s = setup('ADMINISTRACION');
    const matrix = buildMatrixAuth();
    matrix.isAllowed.mockImplementation(async (_o: string, _r: string, _m: string, action: string) => action === 'EVALUATE_FIELD_TRIP_RETURN');
    matrix.assertAllowed.mockImplementation(async () => undefined);
    const access = new HrAdministrationAccessService(buildWorkContext('ADMINISTRACION'), matrix);
    s.fieldTrips.findById.mockResolvedValue(fieldTrip({ status: 'AUTORIZADA' }));
    const result = await new GetFieldTripHandler(access, s.fieldTrips).execute(new GetFieldTripQuery(UID, 'ft-1'));
    expect(result.id).toBe('ft-1');
    expect(result.employee.fullName).toBe('Carlos Perez');
  });
});
