import { ForbiddenException } from '@nestjs/common';
import {
  assertHrAdministrationRoleAllowed,
  isHrAdministrationRoleAllowed,
  HR_ADMINISTRATION_ACTIONS,
  type HrAdministrationAction,
} from './hr-administration-role-policy';
import { WORKER_ROLES } from '../../../users/domain/worker-role';

describe('HrAdministrationRolePolicy (Matriz ADM-02 versión 0)', () => {
  it('define las 9 acciones canónicas de Administración de Personal', () => {
    expect(HR_ADMINISTRATION_ACTIONS).toHaveLength(9);
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
    ]);
  });

  describe('Permisos de Gerencia y RRHH (control total)', () => {
    it.each(HR_ADMINISTRATION_ACTIONS)('permite la acción %s a GERENCIA y RRHH', (action) => {
      expect(isHrAdministrationRoleAllowed('GERENCIA', action)).toBe(true);
      expect(isHrAdministrationRoleAllowed('RRHH', action)).toBe(true);
      expect(() => assertHrAdministrationRoleAllowed('GERENCIA', action)).not.toThrow();
      expect(() => assertHrAdministrationRoleAllowed('RRHH', action)).not.toThrow();
    });
  });

  describe('Permisos de ADMINISTRACION (gestión operativa)', () => {
    it('permite registrar asistencias, colaboradores, vacaciones y salidas a campo', () => {
      expect(isHrAdministrationRoleAllowed('ADMINISTRACION', 'VIEW_EMPLOYEES')).toBe(true);
      expect(isHrAdministrationRoleAllowed('ADMINISTRACION', 'MANAGE_EMPLOYEES')).toBe(true);
      expect(isHrAdministrationRoleAllowed('ADMINISTRACION', 'LOG_ATTENDANCE')).toBe(true);
      expect(isHrAdministrationRoleAllowed('ADMINISTRACION', 'SCHEDULE_VACATION')).toBe(true);
      expect(isHrAdministrationRoleAllowed('ADMINISTRACION', 'REQUEST_FIELD_TRIP')).toBe(true);
      expect(isHrAdministrationRoleAllowed('ADMINISTRACION', 'EVALUATE_FIELD_TRIP_RETURN')).toBe(true);
    });

    it('deniega autorizar permisos exclusivos de jefatura (BR-ADP-003)', () => {
      expect(isHrAdministrationRoleAllowed('ADMINISTRACION', 'AUTHORIZE_LEAVE')).toBe(false);
      expect(() => assertHrAdministrationRoleAllowed('ADMINISTRACION', 'AUTHORIZE_LEAVE')).toThrow(ForbiddenException);
    });

    it('deniega autorizar salida a campo en cascada y desvinculación laboral (BR-ADP-004, BR-ADP-006)', () => {
      expect(isHrAdministrationRoleAllowed('ADMINISTRACION', 'AUTHORIZE_FIELD_TRIP')).toBe(false);
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
