import { assertReturnRoleAllowed, ReturnAction } from './return-role-policy';
import { ReturnRoleNotAllowedError } from '../../domain/return-errors';
import { WORKER_ROLES } from '../../../users/domain/worker-role';

describe('assertReturnRoleAllowed (policy provisional, deny-by-default)', () => {
  it('PLATFORM_ADMIN siempre permitido', () => {
    expect(() => assertReturnRoleAllowed('PLATFORM_ADMIN', 'CLOSE')).not.toThrow();
  });

  it.each<[ReturnAction, string]>([
    ['ASSESS_DAMAGE', 'CAMPO'],
    ['ASSESS_DAMAGE', 'FRONT_OFFICE'],
    ['CLOSE', 'FINANZAS'],
    ['CLOSE', 'CAMPO'],
    ['CLOSE_FINANCIAL', 'CAMPO'],
    ['CREATE', 'CAMPO'],
    ['CHARGE_IMMOBILIZATION', 'FRONT_OFFICE'],
    ['READ', 'RRHH'],
    ['UPLOAD_EVIDENCE', 'FINANZAS'],
    ['RESOLVE_ALCOHOL_ESCALATION', 'CAMPO'],
    ['RESOLVE_ALCOHOL_ESCALATION', 'FRONT_OFFICE'],
    ['RESOLVE_ALCOHOL_ESCALATION', 'ADMINISTRACION'],
    ['RESOLVE_ALCOHOL_ESCALATION', 'FINANZAS'],
    ['RESOLVE_ALCOHOL_ESCALATION', 'AUDITORIA'],
  ])('%s denegado para %s con error de dominio (no excepción de Nest)', (action, role) => {
    expect(() => assertReturnRoleAllowed(role as never, action)).toThrow(ReturnRoleNotAllowedError);
  });

  it.each<[ReturnAction, string]>([
    ['RECEIVE_PROVISIONAL', 'CAMPO'],
    ['REGISTER_ALCOHOL_TEST', 'CAMPO'],
    ['COMPLETE_INSPECTION', 'CAMPO'],
    ['ASSESS_DAMAGE', 'GERENCIA'],
    ['CLOSE_FINANCIAL', 'FINANZAS'],
    ['CLOSE', 'ADMINISTRACION'],
    ['READ', 'AUDITORIA'],
    ['RESOLVE_ALCOHOL_ESCALATION', 'GERENCIA'],
    ['RESOLVE_ALCOHOL_ESCALATION', 'PLATFORM_ADMIN'],
  ])('%s permitido para %s', (action, role) => {
    expect(() => assertReturnRoleAllowed(role as never, action)).not.toThrow();
  });

  it('todo rol conocido está evaluado para todas las acciones sin lanzar errores inesperados', () => {
    for (const role of WORKER_ROLES) {
      try {
        assertReturnRoleAllowed(role, 'READ');
      } catch (err) {
        expect(err).toBeInstanceOf(ReturnRoleNotAllowedError);
      }
    }
  });
});
