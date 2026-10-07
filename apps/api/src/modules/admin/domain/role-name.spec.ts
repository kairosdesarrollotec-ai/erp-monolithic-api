import { normalizeRoleName, ROLE_NAME_MAX_LENGTH } from './role-name';
import { RoleNameInvalidError } from './role-errors';

describe('normalizeRoleName', () => {
  it('recorta espacios y conserva mayusculas/acentos', () => {
    expect(normalizeRoleName('  Jefe de Turno Ñ  ')).toBe('Jefe de Turno Ñ');
  });

  it('acepta exactamente el maximo', () => {
    expect(normalizeRoleName('a'.repeat(ROLE_NAME_MAX_LENGTH))).toHaveLength(ROLE_NAME_MAX_LENGTH);
  });

  it.each([undefined, null, 5, {}, '', '   ', '\t\n', 'a'.repeat(ROLE_NAME_MAX_LENGTH + 1)])('rechaza %j', (value) => {
    expect(() => normalizeRoleName(value)).toThrow(RoleNameInvalidError);
  });
});
