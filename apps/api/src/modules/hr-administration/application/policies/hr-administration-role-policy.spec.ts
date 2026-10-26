import { ForbiddenException } from '@nestjs/common';
import {
  assertHrAdministrationRoleAllowed,
  isHrAdministrationRoleAllowed,
  HR_ADMINISTRATION_ACTIONS,
  type HrAdministrationAction,
} from './hr-administration-role-policy';
import { WORKER_ROLES } from '../../../users/domain/worker-role';

const GERENCIA_ONLY_OR_NOT_HR: readonly HrAdministrationAction[] = [
  'AUTHORIZE_LEAVE',
  'SCHEDULE_VACATION',
  'MANAGE_AREAS',
  'MANAGE_SALARY',
  'REVIEW_ATTENDANCE',
  'MANAGE_GEOFENCE',
  'VIEW_EMPLOYEE_SENSITIVE_DATA',
  'MANAGE_HR_DOCUMENTS',
];

describe('HrAdministrationRolePolicy (Matriz ADM-02 versión 0)', () => {
  it('define las 20 acciones canónicas de Administración de Personal', () => {
    expect(HR_ADMINISTRATION_ACTIONS).toHaveLength(20);
    expect(HR_ADMINISTRATION_ACTIONS).toEqual([
      'VIEW_EMPLOYEES',
      'MANAGE_EMPLOYEES',
      'LOG_ATTENDANCE',
      'AUTHORIZE_LEAVE',
      'SCHEDULE_VACATION',
      'REQUEST_FIELD_TRIP',
      'AUTHORIZE_FIELD_TRIP',
      'EVALUATE_FIELD_TRIP_RETURN',
      'TERMINATE_EMPLOYMENT',
      'REGISTER_TRAINING',
      'MANAGE_AREAS',
      'MANAGE_SALARY',
      'LOG_OWN_ATTENDANCE',
      'REVIEW_ATTENDANCE',
      'MANAGE_GEOFENCE',
      'VIEW_EMPLOYEE_DOCUMENT',
      'VIEW_EMPLOYEE_SENSITIVE_DATA',
      'MANAGE_HR_DOCUMENTS',
      'VIEW_HR_DOCUMENTS',
      'CONFIRM_HR_DOCUMENT_READ',
    ]);
  });

  describe('Permisos de Gerencia y RRHH (control total)', () => {
    it.each(HR_ADMINISTRATION_ACTIONS.filter((a) => !GERENCIA_ONLY_OR_NOT_HR.includes(a)))('permite la acción %s a GERENCIA y RRHH', (action) => {
      expect(isHrAdministrationRoleAllowed('GERENCIA', action)).toBe(true);
      expect(isHrAdministrationRoleAllowed('RRHH', action)).toBe(true);
      expect(() => assertHrAdministrationRoleAllowed('GERENCIA', action)).not.toThrow();
      expect(() => assertHrAdministrationRoleAllowed('RRHH', action)).not.toThrow();
    });
  });

  describe('Permisos de ADMINISTRACION (gestión operativa)', () => {
    it('permite registrar asistencias, colaboradores y salidas a campo, y deniega vacaciones (C5)', () => {
      expect(isHrAdministrationRoleAllowed('ADMINISTRACION', 'VIEW_EMPLOYEES')).toBe(true);
      expect(isHrAdministrationRoleAllowed('ADMINISTRACION', 'MANAGE_EMPLOYEES')).toBe(true);
      expect(isHrAdministrationRoleAllowed('ADMINISTRACION', 'LOG_ATTENDANCE')).toBe(true);
      expect(isHrAdministrationRoleAllowed('ADMINISTRACION', 'SCHEDULE_VACATION')).toBe(false);
      expect(isHrAdministrationRoleAllowed('ADMINISTRACION', 'REQUEST_FIELD_TRIP')).toBe(true);
      expect(isHrAdministrationRoleAllowed('ADMINISTRACION', 'EVALUATE_FIELD_TRIP_RETURN')).toBe(true);
    });

    it('deniega autorizar permisos exclusivos de jefatura (BR-ADP-003)', () => {
      expect(isHrAdministrationRoleAllowed('ADMINISTRACION', 'AUTHORIZE_LEAVE')).toBe(false);
      expect(() => assertHrAdministrationRoleAllowed('ADMINISTRACION', 'AUTHORIZE_LEAVE')).toThrow(ForbiddenException);
    });

    it('permite autorizar salida a campo para nivel 3 (DEC-ADP-FIELD-TRIP-001) y deniega desvinculación laboral (BR-ADP-006)', () => {
      expect(isHrAdministrationRoleAllowed('ADMINISTRACION', 'AUTHORIZE_FIELD_TRIP')).toBe(true);
      expect(isHrAdministrationRoleAllowed('ADMINISTRACION', 'TERMINATE_EMPLOYMENT')).toBe(false);
      expect(() => assertHrAdministrationRoleAllowed('ADMINISTRACION', 'TERMINATE_EMPLOYMENT')).toThrow(ForbiddenException);
    });
  });

  describe('Permisos operativos de CAMPO y FRONT_OFFICE', () => {
    it('permite solicitar salida a campo a colaboradores de campo y front office', () => {
      expect(isHrAdministrationRoleAllowed('CAMPO', 'REQUEST_FIELD_TRIP')).toBe(true);
      expect(isHrAdministrationRoleAllowed('FRONT_OFFICE', 'REQUEST_FIELD_TRIP')).toBe(true);
    });

    it('deniega acceso a gestión de personal y desvinculaciones', () => {
      expect(isHrAdministrationRoleAllowed('CAMPO', 'MANAGE_EMPLOYEES')).toBe(false);
      expect(isHrAdministrationRoleAllowed('CAMPO', 'TERMINATE_EMPLOYMENT')).toBe(false);
      expect(isHrAdministrationRoleAllowed('FRONT_OFFICE', 'TERMINATE_EMPLOYMENT')).toBe(false);
    });
  });

  describe('Permisos de AUDITORIA y FINANZAS', () => {
    it('permite a AUDITORIA consultar expedientes de personal', () => {
      expect(isHrAdministrationRoleAllowed('AUDITORIA', 'VIEW_EMPLOYEES')).toBe(true);
      expect(isHrAdministrationRoleAllowed('AUDITORIA', 'MANAGE_EMPLOYEES')).toBe(false);
    });

    it('permite a FINANZAS consultar personal y asistencias para deducciones de nómina', () => {
      expect(isHrAdministrationRoleAllowed('FINANZAS', 'VIEW_EMPLOYEES')).toBe(true);
      expect(isHrAdministrationRoleAllowed('FINANZAS', 'LOG_ATTENDANCE')).toBe(true);
      expect(isHrAdministrationRoleAllowed('FINANZAS', 'TERMINATE_EMPLOYMENT')).toBe(false);
    });
  });
});

describe('REGISTER_TRAINING (ADP-10)', () => {
  it('solo lo permiten GERENCIA y RRHH', () => {
    expect(isHrAdministrationRoleAllowed('GERENCIA', 'REGISTER_TRAINING')).toBe(true);
    expect(isHrAdministrationRoleAllowed('RRHH', 'REGISTER_TRAINING')).toBe(true);
    expect(isHrAdministrationRoleAllowed('ADMINISTRACION', 'REGISTER_TRAINING')).toBe(false);
    expect(isHrAdministrationRoleAllowed('CAMPO', 'REGISTER_TRAINING')).toBe(false);
  });
});

describe('MANAGE_AREAS y MANAGE_SALARY (Respuestas 2026-10-20 #17 y #19)', () => {
  it.each(['MANAGE_AREAS', 'MANAGE_SALARY'] as const)('%s solo lo permite GERENCIA', (action) => {
    expect(isHrAdministrationRoleAllowed('GERENCIA', action)).toBe(true);
    for (const role of ['RRHH', 'ADMINISTRACION', 'AUDITORIA', 'FINANZAS', 'CAMPO', 'FRONT_OFFICE'] as const) {
      expect(isHrAdministrationRoleAllowed(role, action)).toBe(false);
    }
  });
});

describe('REVIEW_ATTENDANCE y MANAGE_GEOFENCE (22-oct #9, DEC-ADP-ATT-002: revisan Gerencia/Administración, no RRHH)', () => {
  it.each(['REVIEW_ATTENDANCE', 'MANAGE_GEOFENCE'] as const)('%s lo permiten GERENCIA y ADMINISTRACION y lo deniegan los demás roles', (action) => {
    expect(isHrAdministrationRoleAllowed('GERENCIA', action)).toBe(true);
    expect(isHrAdministrationRoleAllowed('ADMINISTRACION', action)).toBe(true);
    for (const role of ['RRHH', 'AUDITORIA', 'FINANZAS', 'CAMPO', 'FRONT_OFFICE'] as const) {
      expect(isHrAdministrationRoleAllowed(role, action)).toBe(false);
    }
  });
});

describe('LOG_OWN_ATTENDANCE y VIEW_EMPLOYEE_DOCUMENT (22-oct #9, HU-35)', () => {
  it('todos los roles de colaborador marcan su propia asistencia', () => {
    for (const role of ['GERENCIA', 'RRHH', 'ADMINISTRACION', 'FINANZAS', 'AUDITORIA', 'CAMPO', 'FRONT_OFFICE'] as const) {
      expect(isHrAdministrationRoleAllowed(role, 'LOG_OWN_ATTENDANCE')).toBe(true);
    }
  });

  it('el documento del colaborador solo lo ven GERENCIA, RRHH y ADMINISTRACION', () => {
    for (const role of ['GERENCIA', 'RRHH', 'ADMINISTRACION'] as const) {
      expect(isHrAdministrationRoleAllowed(role, 'VIEW_EMPLOYEE_DOCUMENT')).toBe(true);
    }
    for (const role of ['AUDITORIA', 'FINANZAS', 'CAMPO', 'FRONT_OFFICE'] as const) {
      expect(isHrAdministrationRoleAllowed(role, 'VIEW_EMPLOYEE_DOCUMENT')).toBe(false);
    }
  });
});

describe('HU-31 y HU-35 (23-oct-2026, Frente R6)', () => {
  it('VIEW_EMPLOYEE_SENSITIVE_DATA solo lo permite GERENCIA por defecto', () => {
    expect(isHrAdministrationRoleAllowed('GERENCIA', 'VIEW_EMPLOYEE_SENSITIVE_DATA')).toBe(true);
    for (const role of ['RRHH', 'ADMINISTRACION', 'AUDITORIA', 'FINANZAS', 'CAMPO', 'FRONT_OFFICE', 'MECANICO'] as const) {
      expect(isHrAdministrationRoleAllowed(role, 'VIEW_EMPLOYEE_SENSITIVE_DATA')).toBe(false);
    }
  });

  it('MANAGE_HR_DOCUMENTS solo lo permite GERENCIA por defecto', () => {
    expect(isHrAdministrationRoleAllowed('GERENCIA', 'MANAGE_HR_DOCUMENTS')).toBe(true);
    for (const role of ['RRHH', 'ADMINISTRACION', 'AUDITORIA', 'FINANZAS', 'CAMPO', 'FRONT_OFFICE', 'MECANICO'] as const) {
      expect(isHrAdministrationRoleAllowed(role, 'MANAGE_HR_DOCUMENTS')).toBe(false);
    }
  });

  it('VIEW_HR_DOCUMENTS y CONFIRM_HR_DOCUMENT_READ lo permiten todos los roles del personal', () => {
    for (const role of ['GERENCIA', 'RRHH', 'ADMINISTRACION', 'AUDITORIA', 'FINANZAS', 'CAMPO', 'FRONT_OFFICE', 'MECANICO'] as const) {
      expect(isHrAdministrationRoleAllowed(role, 'VIEW_HR_DOCUMENTS')).toBe(true);
      expect(isHrAdministrationRoleAllowed(role, 'CONFIRM_HR_DOCUMENT_READ')).toBe(true);
    }
  });

  it('C5: solo GERENCIA aprueba permisos y vacaciones por defecto', () => {
    expect(isHrAdministrationRoleAllowed('GERENCIA', 'AUTHORIZE_LEAVE')).toBe(true);
    expect(isHrAdministrationRoleAllowed('GERENCIA', 'SCHEDULE_VACATION')).toBe(true);
    for (const role of ['RRHH', 'ADMINISTRACION', 'AUDITORIA', 'FINANZAS', 'CAMPO', 'FRONT_OFFICE', 'MECANICO'] as const) {
      expect(isHrAdministrationRoleAllowed(role, 'AUTHORIZE_LEAVE')).toBe(false);
      expect(isHrAdministrationRoleAllowed(role, 'SCHEDULE_VACATION')).toBe(false);
    }
  });
});
