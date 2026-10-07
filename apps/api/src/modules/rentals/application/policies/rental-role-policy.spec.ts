import { assertRentalRoleAllowed } from './rental-role-policy';
import { WORKER_ROLES, WorkerRole } from '../../../users/domain/worker-role';
import { ForbiddenException } from '@nestjs/common';

describe('assertRentalRoleAllowed', () => {
  it('roles operativos (FRONT_OFFICE, ADMINISTRACION, GERENCIA) pueden ejecutar ciclo basico de alquiler', () => {
    const operationalRoles: WorkerRole[] = ['FRONT_OFFICE', 'ADMINISTRACION', 'GERENCIA'];
    const actions = [
      'CREATE',
      'READ',
      'VALIDATE_DOCUMENTS',
      'REGISTER_ALCOHOL_TEST',
      'EVALUATE_NOTARY',
      'FORMALIZE_CONTRACT',
      'COMPLETE_DELIVERY',
    ] as const;

    for (const role of operationalRoles) {
      for (const action of actions) {
        expect(() => assertRentalRoleAllowed(role, action)).not.toThrow();
      }
    }
  });

  it('excepcion notarial (APPROVE_NOTARY_EXCEPTION) solo esta permitida para GERENCIA (SDD §11.2)', () => {
    expect(() => assertRentalRoleAllowed('GERENCIA', 'APPROVE_NOTARY_EXCEPTION')).not.toThrow();

    const nonGerenciaRoles: WorkerRole[] = [
      'FRONT_OFFICE',
      'ADMINISTRACION',
      'AUDITORIA',
      'FINANZAS',
      'CAMPO',
      'RRHH',
    ];

    for (const role of nonGerenciaRoles) {
      expect(() => assertRentalRoleAllowed(role, 'APPROVE_NOTARY_EXCEPTION')).toThrow(ForbiddenException);
    }
  });

  it('roles operativos (FRONT_OFFICE, ADMINISTRACION, GERENCIA) pueden solicitar ampliacion (REQUEST_EXTENSION)', () => {
    const operationalRoles: WorkerRole[] = ['FRONT_OFFICE', 'ADMINISTRACION', 'GERENCIA'];
    for (const role of operationalRoles) {
      expect(() => assertRentalRoleAllowed(role, 'REQUEST_EXTENSION')).not.toThrow();
    }
  });

  it('autorizar/rechazar ampliacion (BR-ALQ-012/013) solo esta permitido para GERENCIA', () => {
    expect(() => assertRentalRoleAllowed('GERENCIA', 'AUTHORIZE_EXTENSION')).not.toThrow();
    expect(() => assertRentalRoleAllowed('GERENCIA', 'REJECT_EXTENSION')).not.toThrow();

    const nonGerenciaRoles: WorkerRole[] = [
      'FRONT_OFFICE',
      'ADMINISTRACION',
      'AUDITORIA',
      'FINANZAS',
      'CAMPO',
      'RRHH',
    ];

    for (const role of nonGerenciaRoles) {
      expect(() => assertRentalRoleAllowed(role, 'AUTHORIZE_EXTENSION')).toThrow(ForbiddenException);
      expect(() => assertRentalRoleAllowed(role, 'REJECT_EXTENSION')).toThrow(ForbiddenException);
    }
  });

  it('falta grave de ampliacion (BR-ALQ-013, REPORT_EXTENSION_BREACH) solo esta permitida para GERENCIA', () => {
    expect(() => assertRentalRoleAllowed('GERENCIA', 'REPORT_EXTENSION_BREACH')).not.toThrow();

    const nonGerenciaRoles: WorkerRole[] = [
      'FRONT_OFFICE',
      'ADMINISTRACION',
      'AUDITORIA',
      'FINANZAS',
      'CAMPO',
      'RRHH',
    ];

    for (const role of nonGerenciaRoles) {
      expect(() => assertRentalRoleAllowed(role, 'REPORT_EXTENSION_BREACH')).toThrow(ForbiddenException);
    }
  });

  it('PLATFORM_ADMIN ya no tiene pase irrestricto: se rige por la matriz (sembrada en true)', () => {
    expect(() => assertRentalRoleAllowed('PLATFORM_ADMIN', 'CREATE')).toThrow(ForbiddenException);
  });
});
