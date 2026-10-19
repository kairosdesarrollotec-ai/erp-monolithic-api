import { ForbiddenException } from '@nestjs/common';
import {
  EmployeeAccountAlreadyLinkedError,
  EmployeeEmailRequiredError,
  EmployeeNotFoundError,
  EmployeeTerminatedError,
  InvalidAttendanceEvidenceError,
  UserAccountNotFoundError,
} from '../../domain/hr-administration-errors';
import { attendanceEvidenceKeyPrefix, normalizeEmail } from '../../domain/hr-administration-rules';
import {
  COMPANY_ID,
  buildAudit,
  buildEmployee,
  buildMatrixAuth,
  buildTransactionManager,
  buildWorkContext,
} from '../../testing/hr-administration-test-fixtures';
import { HrAdministrationAccessService } from '../services/hr-administration-access.service';
import { EmployeeAccountLinkService } from '../services/employee-account-link.service';
import type { EmployeeRepositoryPort } from '../ports/employee-repository.port';
import type { AttendanceEvidenceStoragePort } from '../ports/attendance-evidence-storage.port';
import type { UserAccountEmailPort } from '../ports/user-account-email.port';
import { RequestAttendanceEvidenceUploadSessionCommand } from './request-attendance-evidence-upload-session.command';
import { RequestAttendanceEvidenceUploadSessionHandler } from './request-attendance-evidence-upload-session.handler';
import { LinkEmployeeAccountCommand } from './link-employee-account.command';
import { LinkEmployeeAccountHandler } from './link-employee-account.handler';
import { CreateEmployeeCommand } from './create-employee.command';
import { CreateEmployeeHandler } from './create-employee.handler';
import { UpdateEmployeeCommand } from './update-employee.command';
import { UpdateEmployeeHandler } from './update-employee.handler';

const UID = 'uid-1';
type Role = 'RRHH' | 'CAMPO' | 'forbidden';

function employeesMock() {
  return {
    findById: jest.fn(), findByCompanyAndDocument: jest.fn(), create: jest.fn(), update: jest.fn(),
    findByFirebaseUid: jest.fn(), findActiveByEmail: jest.fn(), linkFirebaseUid: jest.fn(), setFirebaseUid: jest.fn(),
  } as unknown as jest.Mocked<EmployeeRepositoryPort>;
}

describe('RequestAttendanceEvidenceUploadSessionHandler (DEC-ADP-ATT-EVIDENCE-002)', () => {
  const session = { uploadUrl: 'https://signed', objectUrl: 'https://obj', storageRef: 'k', expiresAt: new Date() };
  function build(role: Role) {
    const wc = buildWorkContext(role);
    const access = new HrAdministrationAccessService(wc, buildMatrixAuth());
    const employees = employeesMock();
    const storage = { generateSignedUploadUrl: jest.fn().mockResolvedValue(session) } as unknown as jest.Mocked<AttendanceEvidenceStoragePort>;
    return { wc, employees, storage, handler: new RequestAttendanceEvidenceUploadSessionHandler(access, wc, employees, storage) };
  }
  const cmd = (type = 'image/jpeg', size = 1000, uid = UID) =>
    new RequestAttendanceEvidenceUploadSessionCommand(uid, 'emp-1', type, size);

  it('404 si el colaborador no existe', async () => {
    const b = build('RRHH');
    b.employees.findById.mockResolvedValue(null);
    await expect(b.handler.execute(cmd())).rejects.toBeInstanceOf(EmployeeNotFoundError);
  });

  it('personal con LOG_ATTENDANCE obtiene la URL para cualquier colaborador', async () => {
    const b = build('RRHH');
    b.employees.findById.mockResolvedValue(buildEmployee());
    await expect(b.handler.execute(cmd())).resolves.toEqual(session);
    expect(b.storage.generateSignedUploadUrl).toHaveBeenCalledWith({
      companyId: COMPANY_ID, employeeId: 'emp-1', contentType: 'image/jpeg',
    });
  });

  it('el propio colaborador (ficha vinculada a su cuenta) sube su foto sin permiso de Personal', async () => {
    const b = build('CAMPO');
    b.employees.findById.mockResolvedValue(buildEmployee({ firebaseUid: UID }));
    await expect(b.handler.execute(cmd())).resolves.toEqual(session);
  });

  it('403 si no es el propio colaborador y su rol no tiene LOG_ATTENDANCE', async () => {
    const b = build('CAMPO');
    b.employees.findById.mockResolvedValue(buildEmployee({ firebaseUid: 'otro' }));
    await expect(b.handler.execute(cmd())).rejects.toBeInstanceOf(ForbiddenException);
    expect(b.storage.generateSignedUploadUrl).not.toHaveBeenCalled();
  });

  it('403 si la ficha es propia pero no hay asignación vigente en la sede', async () => {
    const b = build('forbidden');
    b.employees.findById.mockResolvedValue(buildEmployee({ firebaseUid: UID }));
    await expect(b.handler.execute(cmd())).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rechaza tipo no admitido, tamaño excedido y colaborador terminado', async () => {
    const b = build('RRHH');
    b.employees.findById.mockResolvedValue(buildEmployee());
    await expect(b.handler.execute(cmd('application/pdf'))).rejects.toBeInstanceOf(InvalidAttendanceEvidenceError);
    await expect(b.handler.execute(cmd('image/jpeg', 13 * 1024 * 1024))).rejects.toBeInstanceOf(InvalidAttendanceEvidenceError);
    b.employees.findById.mockResolvedValue(buildEmployee({ status: 'TERMINADO' }));
    await expect(b.handler.execute(cmd())).rejects.toBeInstanceOf(EmployeeTerminatedError);
  });
});

describe('reglas de evidencia y correo', () => {
  it('prefijo de clave por empresa y colaborador', () => {
    expect(attendanceEvidenceKeyPrefix('c1', 'e1')).toBe('companies/c1/employees/e1/attendance/');
  });
  it('normalizeEmail recorta y pasa a minúsculas; vacío -> null', () => {
    expect(normalizeEmail('  Ana.Perez@Kairos.PE ')).toBe('ana.perez@kairos.pe');
    expect(normalizeEmail('   ')).toBeNull();
    expect(normalizeEmail(undefined)).toBeNull();
  });
});

describe('vínculo usuario-ficha por correo (DEC-ADP-LINK-EMAIL-001)', () => {
  function build(role: Role = 'RRHH') {
    const wc = buildWorkContext(role);
    const access = new HrAdministrationAccessService(wc, buildMatrixAuth());
    const employees = employeesMock();
    const accounts = { findEmail: jest.fn(), findUidByEmail: jest.fn() } as unknown as jest.Mocked<UserAccountEmailPort>;
    const linker = new EmployeeAccountLinkService(employees, accounts);
    const tm = buildTransactionManager();
    const audit = buildAudit();
    return { employees, accounts, linker, tm, audit, handler: new LinkEmployeeAccountHandler(access, employees, linker, tm, audit) };
  }
  const cmd = () => new LinkEmployeeAccountCommand(UID, 'emp-1');

  it('vincula por correo normalizado y audita', async () => {
    const b = build();
    b.employees.findById.mockResolvedValue(buildEmployee({ email: ' Ana@Kairos.PE ' }));
    b.accounts.findUidByEmail.mockResolvedValue('uid-ana');
    b.employees.findByFirebaseUid.mockResolvedValue(null);
    b.employees.linkFirebaseUid.mockResolvedValue(buildEmployee({ email: 'ana@kairos.pe', firebaseUid: 'uid-ana' }));
    const result = await b.handler.execute(cmd());
    expect(b.accounts.findUidByEmail).toHaveBeenCalledWith('ana@kairos.pe');
    expect(result.firebaseUid).toBe('uid-ana');
    expect(b.audit.recordHrAdministrationEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'EMPLOYEE_ACCOUNT_LINKED' }), b.tm.tx,
    );
  });

  it('idempotente: si ya está vinculada a esa cuenta no toca nada ni audita', async () => {
    const b = build();
    b.employees.findById.mockResolvedValue(buildEmployee({ email: 'ana@kairos.pe', firebaseUid: 'uid-ana' }));
    b.accounts.findUidByEmail.mockResolvedValue('uid-ana');
    await b.handler.execute(cmd());
    expect(b.employees.linkFirebaseUid).not.toHaveBeenCalled();
    expect(b.audit.recordHrAdministrationEvent).not.toHaveBeenCalled();
  });

  it('409 si la cuenta de ese correo ya está vinculada a OTRO colaborador', async () => {
    const b = build();
    b.employees.findById.mockResolvedValue(buildEmployee({ email: 'ana@kairos.pe' }));
    b.accounts.findUidByEmail.mockResolvedValue('uid-ana');
    b.employees.findByFirebaseUid.mockResolvedValue(buildEmployee({ id: 'emp-2', firebaseUid: 'uid-ana' }));
    const err = await b.handler.execute(cmd()).catch((e) => e);
    expect(err).toBeInstanceOf(EmployeeAccountAlreadyLinkedError);
    expect(err.code).toBe('EMPLOYEE_ACCOUNT_ALREADY_LINKED');
    expect(b.employees.linkFirebaseUid).not.toHaveBeenCalled();
  });

  it('409 si la ficha ya está vinculada a otra cuenta; 409 ante carrera (linkFirebaseUid no aplicó)', async () => {
    const b = build();
    b.employees.findById.mockResolvedValue(buildEmployee({ email: 'ana@kairos.pe', firebaseUid: 'uid-vieja' }));
    b.accounts.findUidByEmail.mockResolvedValue('uid-ana');
    await expect(b.handler.execute(cmd())).rejects.toBeInstanceOf(EmployeeAccountAlreadyLinkedError);

    b.employees.findById.mockResolvedValue(buildEmployee({ email: 'ana@kairos.pe' }));
    b.employees.findByFirebaseUid.mockResolvedValue(null);
    b.employees.linkFirebaseUid.mockResolvedValue(buildEmployee({ firebaseUid: 'otra-carrera' }));
    await expect(b.handler.execute(cmd())).rejects.toBeInstanceOf(EmployeeAccountAlreadyLinkedError);
  });

  it('422 sin correo en la ficha, 404 sin cuenta, 409 si está terminado', async () => {
    const b = build();
    b.employees.findById.mockResolvedValue(buildEmployee({ email: null }));
    await expect(b.handler.execute(cmd())).rejects.toBeInstanceOf(EmployeeEmailRequiredError);
    b.employees.findById.mockResolvedValue(buildEmployee({ email: 'ana@kairos.pe' }));
    b.accounts.findUidByEmail.mockResolvedValue(null);
    await expect(b.handler.execute(cmd())).rejects.toBeInstanceOf(UserAccountNotFoundError);
    b.employees.findById.mockResolvedValue(buildEmployee({ status: 'TERMINADO', email: 'a@b.pe' }));
    await expect(b.handler.execute(cmd())).rejects.toBeInstanceOf(EmployeeTerminatedError);
  });

  it('403 sin MANAGE_EMPLOYEES', async () => {
    const b = build('CAMPO');
    b.employees.findById.mockResolvedValue(buildEmployee({ email: 'ana@kairos.pe' }));
    await expect(b.handler.execute(cmd())).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('tryLink nunca lanza: ante conflicto devuelve la ficha sin vincular', async () => {
    const b = build();
    const emp = buildEmployee({ email: 'ana@kairos.pe' });
    b.accounts.findUidByEmail.mockResolvedValue('uid-ana');
    b.employees.findByFirebaseUid.mockResolvedValue(buildEmployee({ id: 'emp-2', firebaseUid: 'uid-ana' }));
    await expect(b.linker.tryLink(emp)).resolves.toBe(emp);
    b.accounts.findUidByEmail.mockRejectedValue(new Error('firebase caído'));
    await expect(b.linker.tryLink(emp)).resolves.toBe(emp);
  });

  it('CreateEmployee: normaliza el correo y vincula si existe la cuenta', async () => {
    const b = build();
    const access = new HrAdministrationAccessService(buildWorkContext('RRHH'), buildMatrixAuth());
    const handler = new CreateEmployeeHandler(access, b.employees, b.tm, b.audit, b.linker);
    b.employees.findByCompanyAndDocument.mockResolvedValue(null);
    const created = buildEmployee({ email: 'ana@kairos.pe' });
    b.employees.create.mockResolvedValue(created);
    b.accounts.findUidByEmail.mockResolvedValue('uid-ana');
    b.employees.findByFirebaseUid.mockResolvedValue(null);
    b.employees.linkFirebaseUid.mockResolvedValue({ ...created, firebaseUid: 'uid-ana' });
    const result = await handler.execute(
      new CreateEmployeeCommand(UID, COMPANY_ID, 'branch-hr-1', 'DNI', '45678912', 'Ana', 'OPERACIONES', 'Operaciones', 'Aux', new Date(), '  ANA@Kairos.pe '),
    );
    expect(b.employees.create).toHaveBeenCalledWith(expect.objectContaining({ email: 'ana@kairos.pe' }), b.tm.tx);
    expect(result.firebaseUid).toBe('uid-ana');
  });
  describe('UpdateEmployee: correo cambiado en ficha vinculada -> re-vinculación', () => {
    function setup(existing = buildEmployee({ email: 'ana@kairos.pe', firebaseUid: 'uid-ana' })) {
      const b = build();
      const access = new HrAdministrationAccessService(buildWorkContext('RRHH'), buildMatrixAuth());
      const handler = new UpdateEmployeeHandler(access, b.employees, b.tm, b.audit, b.linker);
      b.employees.findById.mockResolvedValue(existing);
      b.employees.update.mockImplementation(async (_id, data) => ({ ...existing, ...(data as object) }) as never);
      b.employees.setFirebaseUid.mockImplementation(async (_id, uid) => ({ ...existing, email: 'nuevo@kairos.pe', firebaseUid: uid }) as never);
      return { b, handler };
    }
    const run = (h: UpdateEmployeeHandler) => h.execute(new UpdateEmployeeCommand(UID, 'emp-1', { email: ' NUEVO@Kairos.pe ' }));

    it('re-vincula a la cuenta del correo nuevo y audita EMPLOYEE_ACCOUNT_RELINKED', async () => {
      const { b, handler } = setup();
      b.accounts.findUidByEmail.mockResolvedValue('uid-nuevo');
      b.employees.findByFirebaseUid.mockResolvedValue(null);
      const r = await run(handler);
      expect(b.employees.setFirebaseUid).toHaveBeenCalledWith('emp-1', 'uid-nuevo', b.tm.tx);
      expect(r.firebaseUid).toBe('uid-nuevo');
      expect(b.audit.recordHrAdministrationEvent).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'EMPLOYEE_ACCOUNT_RELINKED' }), b.tm.tx,
      );
    });

    it('sin cuenta para el correo nuevo: queda sin vincular y se audita EMPLOYEE_ACCOUNT_UNLINKED', async () => {
      const { b, handler } = setup();
      b.accounts.findUidByEmail.mockResolvedValue(null);
      const r = await run(handler);
      expect(b.employees.setFirebaseUid).toHaveBeenCalledWith('emp-1', null, b.tm.tx);
      expect(r.firebaseUid).toBeNull();
      expect(b.audit.recordHrAdministrationEvent).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'EMPLOYEE_ACCOUNT_UNLINKED' }), b.tm.tx,
      );
    });

    it('409 si la cuenta del correo nuevo ya pertenece a otro colaborador (no se aplica nada)', async () => {
      const { b, handler } = setup();
      b.accounts.findUidByEmail.mockResolvedValue('uid-otro');
      b.employees.findByFirebaseUid.mockResolvedValue(buildEmployee({ id: 'emp-2', firebaseUid: 'uid-otro' }));
      await expect(run(handler)).rejects.toBeInstanceOf(EmployeeAccountAlreadyLinkedError);
      expect(b.employees.setFirebaseUid).not.toHaveBeenCalled();
    });

    it('correo sin cambio efectivo o ficha no vinculada: no toca el vínculo', async () => {
      const { b, handler } = setup();
      await handler.execute(new UpdateEmployeeCommand(UID, 'emp-1', { email: ' ANA@kairos.pe' }));
      await handler.execute(new UpdateEmployeeCommand(UID, 'emp-1', { jobTitle: 'Jefe' }));
      expect(b.employees.setFirebaseUid).not.toHaveBeenCalled();
      expect(b.accounts.findUidByEmail).not.toHaveBeenCalled();
    });
  });
});
