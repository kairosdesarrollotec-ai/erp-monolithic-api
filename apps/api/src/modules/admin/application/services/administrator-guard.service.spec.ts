import { AdministratorGuardService } from './administrator-guard.service';
import { AdminUserRepositoryPort, EffectiveAssignmentRecord } from '../ports/admin-user-repository.port';
import { RolePermissionMatrixPort, RolePermissionMatrixSnapshot } from '../ports/role-permission-matrix.port';
import { LastAdministratorRoleError } from '../../domain/role-errors';

const ADMIN_ENTRIES = (roleId: string, allowed = true) => [
  { roleId, module: 'ADMIN' as const, action: 'MANAGE_PERMISSIONS', allowed },
  { roleId, module: 'ADMIN' as const, action: 'MANAGE_USERS', allowed },
];
const orgSnapshot = (entries: any[], version = 1): RolePermissionMatrixSnapshot => ({ version, scope: { companyId: null, branchId: null }, entries });

function build(assignments: EffectiveAssignmentRecord[], snapshots: RolePermissionMatrixSnapshot[]) {
  const adminUsers = { listEffectiveAssignments: jest.fn().mockResolvedValue(assignments) } as unknown as jest.Mocked<AdminUserRepositoryPort>;
  const matrix = { getAllCurrentSnapshots: jest.fn().mockResolvedValue(snapshots) } as unknown as jest.Mocked<RolePermissionMatrixPort>;
  return { adminUsers, matrix, guard: new AdministratorGuardService(adminUsers, matrix) };
}

const a = (id: string, roleId: string, companyId = 'c1', branchId = 'b1'): EffectiveAssignmentRecord => ({ id, roleId, companyId, branchId });

describe('AdministratorGuardService', () => {
  it('administratorAssignmentIds devuelve solo asignaciones cuyo rol tiene ambos permisos de administracion (no depende del nombre del rol)', async () => {
    const { guard } = build(
      [a('1', 'role-boss'), a('2', 'role-clerk'), a('3', 'role-boss', 'c2', 'b2')],
      [orgSnapshot([...ADMIN_ENTRIES('role-boss'), ...ADMIN_ENTRIES('role-clerk', false)])],
    );

    expect(await guard.administratorAssignmentIds('org-1', undefined)).toEqual(['1', '3']);
  });

  it('respeta el ambito de la asignacion: un override de sede puede quitar la administracion en esa sede', async () => {
    const branchOverride: RolePermissionMatrixSnapshot = { version: 2, scope: { companyId: 'c1', branchId: 'b1' }, entries: ADMIN_ENTRIES('role-boss', false) };
    const { guard } = build([a('1', 'role-boss', 'c1', 'b1'), a('2', 'role-boss', 'c1', 'b2')], [orgSnapshot(ADMIN_ENTRIES('role-boss')), branchOverride]);

    expect(await guard.administratorAssignmentIds('org-1', undefined)).toEqual(['2']);
  });

  describe('assertMatrixKeepsAnAdministrator', () => {
    it('409 si la foto candidata deja a la organizacion sin administradores', async () => {
      const { guard } = build([a('1', 'role-boss')], [orgSnapshot(ADMIN_ENTRIES('role-boss'))]);
      const candidate = orgSnapshot(ADMIN_ENTRIES('role-boss', false), 0);

      await expect(guard.assertMatrixKeepsAnAdministrator('org-1', candidate, undefined)).rejects.toBeInstanceOf(LastAdministratorRoleError);
    });

    it('permite la foto candidata si sigue habiendo un administrador', async () => {
      const { guard } = build([a('1', 'role-boss'), a('2', 'role-other')], [orgSnapshot(ADMIN_ENTRIES('role-boss'))]);
      const candidate = orgSnapshot([...ADMIN_ENTRIES('role-boss', false), ...ADMIN_ENTRIES('role-other')], 0);

      await expect(guard.assertMatrixKeepsAnAdministrator('org-1', candidate, undefined)).resolves.toBeUndefined();
    });

    it('no bloquea si ya no habia ningun administrador (no lo empeora)', async () => {
      const { guard } = build([a('1', 'role-x')], [orgSnapshot(ADMIN_ENTRIES('role-x', false))]);

      await expect(guard.assertMatrixKeepsAnAdministrator('org-1', orgSnapshot(ADMIN_ENTRIES('role-x', false), 0), undefined)).resolves.toBeUndefined();
    });

    it('la foto candidata reemplaza SOLO a la de su propio ambito', async () => {
      const company: RolePermissionMatrixSnapshot = { version: 2, scope: { companyId: 'c1', branchId: null }, entries: ADMIN_ENTRIES('role-boss', false) };
      const { guard } = build([a('1', 'role-boss', 'c2', 'b9')], [orgSnapshot(ADMIN_ENTRIES('role-boss')), company]);
      const candidate: RolePermissionMatrixSnapshot = { version: 0, scope: { companyId: 'c1', branchId: null }, entries: ADMIN_ENTRIES('role-boss', false) };

      await expect(guard.assertMatrixKeepsAnAdministrator('org-1', candidate, undefined)).resolves.toBeUndefined();
    });
  });

  describe('assertRoleDeactivationKeepsAnAdministrator', () => {
    it('409 si todos los administradores pertenecen al rol a desactivar', async () => {
      const { guard } = build([a('1', 'role-boss')], [orgSnapshot(ADMIN_ENTRIES('role-boss'))]);

      await expect(guard.assertRoleDeactivationKeepsAnAdministrator('org-1', 'role-boss', undefined)).rejects.toBeInstanceOf(LastAdministratorRoleError);
    });

    it('permite desactivar un rol si queda otro rol administrador', async () => {
      const { guard } = build([a('1', 'role-boss'), a('2', 'role-boss2')], [orgSnapshot([...ADMIN_ENTRIES('role-boss'), ...ADMIN_ENTRIES('role-boss2')])]);

      await expect(guard.assertRoleDeactivationKeepsAnAdministrator('org-1', 'role-boss', undefined)).resolves.toBeUndefined();
    });

    it('permite desactivar un rol que no es administrador', async () => {
      const { guard } = build([a('1', 'role-boss')], [orgSnapshot(ADMIN_ENTRIES('role-boss'))]);

      await expect(guard.assertRoleDeactivationKeepsAnAdministrator('org-1', 'role-clerk', undefined)).resolves.toBeUndefined();
    });
  });
});
