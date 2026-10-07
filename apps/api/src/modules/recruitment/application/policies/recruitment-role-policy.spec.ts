import { ForbiddenException } from '@nestjs/common';
import { buildDefaultRolePermissionMatrix } from '../../../admin/domain/default-role-permission-matrix';
import { PERMISSION_ACTION_CATALOG } from '../../../admin/domain/permission-action-catalog';
import { WORKER_ROLES } from '../../../users/domain/worker-role';
import {
  assertRecruitmentRoleAllowed,
  isRecruitmentRoleAllowed,
  RECRUITMENT_ACTIONS,
  RecruitmentAction,
} from './recruitment-role-policy';

describe('recruitment-role-policy (RECRUITMENT.*)', () => {
  const roleIdByKey = new Map(WORKER_ROLES.map((k) => [k, `role-${k}`]));
  const keyById = new Map(WORKER_ROLES.map((k) => [`role-${k}`, k]));

  it.each(['GERENCIA', 'RRHH'] as const)('%s tiene acceso a todas las 10 acciones de reclutamiento', (role) => {
    for (const action of RECRUITMENT_ACTIONS) {
      expect(isRecruitmentRoleAllowed(role, action)).toBe(true);
    }
  });

  it('ADMINISTRACION puede gestionar operativamente pero no decidir ni ver datos sensibles', () => {
    expect(isRecruitmentRoleAllowed('ADMINISTRACION', 'VIEW_VACANCY')).toBe(true);
    expect(isRecruitmentRoleAllowed('ADMINISTRACION', 'CREATE_VACANCY')).toBe(true);
    expect(isRecruitmentRoleAllowed('ADMINISTRACION', 'REGISTER_CANDIDATE')).toBe(true);
    expect(isRecruitmentRoleAllowed('ADMINISTRACION', 'VIEW_CANDIDATE')).toBe(true);
    expect(isRecruitmentRoleAllowed('ADMINISTRACION', 'MANAGE_INTERVIEW')).toBe(true);
    expect(isRecruitmentRoleAllowed('ADMINISTRACION', 'MANAGE_ONBOARDING')).toBe(true);

    expect(isRecruitmentRoleAllowed('ADMINISTRACION', 'VIEW_CANDIDATE_SENSITIVE_DATA')).toBe(false);
    expect(isRecruitmentRoleAllowed('ADMINISTRACION', 'DECIDE_CANDIDATE')).toBe(false);
    expect(isRecruitmentRoleAllowed('ADMINISTRACION', 'PUBLISH_VACANCY')).toBe(false);
    expect(isRecruitmentRoleAllowed('ADMINISTRACION', 'EVALUATE_PROBATION')).toBe(false);
  });

  it('FRONT_OFFICE puede registrar necesidad y ver vacantes', () => {
    expect(isRecruitmentRoleAllowed('FRONT_OFFICE', 'VIEW_VACANCY')).toBe(true);
    expect(isRecruitmentRoleAllowed('FRONT_OFFICE', 'CREATE_VACANCY')).toBe(true);
    expect(isRecruitmentRoleAllowed('FRONT_OFFICE', 'REGISTER_CANDIDATE')).toBe(false);
    expect(isRecruitmentRoleAllowed('FRONT_OFFICE', 'DECIDE_CANDIDATE')).toBe(false);
  });

  it('CAMPO solo puede ver convocatorias (vacantes)', () => {
    expect(isRecruitmentRoleAllowed('CAMPO', 'VIEW_VACANCY')).toBe(true);
    expect(isRecruitmentRoleAllowed('CAMPO', 'CREATE_VACANCY')).toBe(false);
    expect(isRecruitmentRoleAllowed('CAMPO', 'VIEW_CANDIDATE')).toBe(false);
  });

  it('FINANZAS puede ver vacantes y datos sensibles (bandas salariales) pero no decidir ni evaluar', () => {
    expect(isRecruitmentRoleAllowed('FINANZAS', 'VIEW_VACANCY')).toBe(true);
    expect(isRecruitmentRoleAllowed('FINANZAS', 'VIEW_CANDIDATE_SENSITIVE_DATA')).toBe(true);
    expect(isRecruitmentRoleAllowed('FINANZAS', 'DECIDE_CANDIDATE')).toBe(false);
    expect(isRecruitmentRoleAllowed('FINANZAS', 'REGISTER_CANDIDATE')).toBe(false);
  });

  it('AUDITORIA es solo lectura basica sin datos sensibles', () => {
    expect(isRecruitmentRoleAllowed('AUDITORIA', 'VIEW_VACANCY')).toBe(true);
    expect(isRecruitmentRoleAllowed('AUDITORIA', 'VIEW_CANDIDATE')).toBe(true);
    expect(isRecruitmentRoleAllowed('AUDITORIA', 'VIEW_CANDIDATE_SENSITIVE_DATA')).toBe(false);
    expect(isRecruitmentRoleAllowed('AUDITORIA', 'DECIDE_CANDIDATE')).toBe(false);
  });

  it('PLATFORM_ADMIN no tiene atajo en la politica directa (se siembra en la matriz)', () => {
    expect(isRecruitmentRoleAllowed('PLATFORM_ADMIN', 'DECIDE_CANDIDATE')).toBe(false);
  });

  it('assert lanza 403 ROLE_NOT_ALLOWED cuando no esta permitido', () => {
    expect(() => assertRecruitmentRoleAllowed('FRONT_OFFICE', 'DECIDE_CANDIDATE')).toThrow(ForbiddenException);
    expect(() => assertRecruitmentRoleAllowed('GERENCIA', 'DECIDE_CANDIDATE')).not.toThrow();
  });

  it('el catalogo ADM-02 expone las 10 acciones RECRUITMENT y la matriz v0 las deriva de esta politica', () => {
    const catalogActions = PERMISSION_ACTION_CATALOG.filter((d) => d.module === 'RECRUITMENT').map((d) => d.action).sort();
    expect(catalogActions).toEqual([...RECRUITMENT_ACTIONS].sort());

    const entries = buildDefaultRolePermissionMatrix(roleIdByKey).filter((e) => e.module === 'RECRUITMENT');
    expect(entries).toHaveLength(WORKER_ROLES.length * 10);
    for (const entry of entries) {
      const key = keyById.get(entry.roleId)!;
      expect(entry.allowed).toBe(
        key === 'PLATFORM_ADMIN' ? true : isRecruitmentRoleAllowed(key, entry.action as RecruitmentAction),
      );
    }
  });
});
