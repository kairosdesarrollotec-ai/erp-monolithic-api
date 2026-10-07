import {
  effectivePermissionsOf,
  hasAdministratorPermissions,
  isAllowedByLayers,
  layersForContext,
  matrixVersionOf,
  scopeKey,
} from './matrix-resolution';
import { RolePermissionMatrixSnapshot } from '../application/ports/role-permission-matrix.port';

const entry = (roleId: string, module: any, action: string, allowed: boolean) => ({ roleId, module, action, allowed });
const snap = (version: number, companyId: string | null, branchId: string | null, entries: any[]): RolePermissionMatrixSnapshot => ({
  version,
  scope: { companyId, branchId },
  entries,
});

describe('matrix-resolution', () => {
  const org = snap(1, null, null, [entry('r', 'RESERVATION', 'CREATE', true), entry('r', 'RESERVATION', 'CONFIRM', true)]);
  const company = snap(2, 'c1', null, [entry('r', 'RESERVATION', 'CONFIRM', false)]);
  const branch = snap(3, 'c1', 'b1', [entry('r', 'RESERVATION', 'CONFIRM', true), entry('r', 'RENTAL', 'READ', true)]);
  const all = [org, company, branch, snap(4, 'c2', null, [entry('r', 'RESERVATION', 'CREATE', false)])];

  it('scopeKey distingue organizacion, empresa y sede', () => {
    expect(new Set([scopeKey({ companyId: null, branchId: null }), scopeKey({ companyId: 'c1', branchId: null }), scopeKey({ companyId: 'c1', branchId: 'b1' })]).size).toBe(3);
  });

  it('layersForContext devuelve de la capa mas especifica a la menos y solo las que existen para ese contexto', () => {
    expect(layersForContext(all, { companyId: 'c1', branchId: 'b1' })).toEqual([branch, company, org]);
    expect(layersForContext(all, { companyId: 'c1', branchId: 'b-otra' })).toEqual([company, org]);
    expect(layersForContext(all, { companyId: 'c3', branchId: 'b9' })).toEqual([org]);
    expect(layersForContext(all, null)).toEqual([org]);
  });

  it('la capa mas especifica con entrada gana (aunque sea false); sin entrada baja a la siguiente; sin ninguna = denegado', () => {
    const layers = layersForContext(all, { companyId: 'c1', branchId: 'b1' });
    expect(isAllowedByLayers(layers, 'r', 'RESERVATION', 'CONFIRM')).toBe(true); // sede
    expect(isAllowedByLayers(layersForContext(all, { companyId: 'c1', branchId: 'b-otra' }), 'r', 'RESERVATION', 'CONFIRM')).toBe(false); // empresa pisa a organizacion
    expect(isAllowedByLayers(layers, 'r', 'RESERVATION', 'CREATE')).toBe(true); // hereda de organizacion
    expect(isAllowedByLayers(layers, 'r', 'INQUIRY', 'READ')).toBe(false); // sin entrada
    expect(isAllowedByLayers(layers, 'otro-rol', 'RESERVATION', 'CREATE')).toBe(false); // otro rol
  });

  it('effectivePermissionsOf lista solo lo permitido, en orden del catalogo', () => {
    const permissions = effectivePermissionsOf(layersForContext(all, { companyId: 'c1', branchId: 'b1' }), 'r');
    expect(permissions).toEqual(
      expect.arrayContaining([
        { module: 'RESERVATION', action: 'CREATE' },
        { module: 'RESERVATION', action: 'CONFIRM' },
        { module: 'RENTAL', action: 'READ' },
      ]),
    );
    expect(permissions).toHaveLength(3);
  });

  it('matrixVersionOf toma la mayor version de las capas (0 si no hay)', () => {
    expect(matrixVersionOf([org, company, branch])).toBe(3);
    expect(matrixVersionOf([])).toBe(0);
  });

  it('hasAdministratorPermissions exige MANAGE_PERMISSIONS y MANAGE_USERS a la vez', () => {
    const both = snap(1, null, null, [entry('a', 'ADMIN', 'MANAGE_PERMISSIONS', true), entry('a', 'ADMIN', 'MANAGE_USERS', true)]);
    const one = snap(1, null, null, [entry('a', 'ADMIN', 'MANAGE_PERMISSIONS', true), entry('a', 'ADMIN', 'MANAGE_USERS', false)]);
    expect(hasAdministratorPermissions([both], 'a')).toBe(true);
    expect(hasAdministratorPermissions([one], 'a')).toBe(false);
    expect(hasAdministratorPermissions([], 'a')).toBe(false);
  });
});
