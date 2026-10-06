import { RoleNameInvalidError } from './role-errors';

export const ROLE_NAME_MAX_LENGTH = 60;

/** Recorta espacios y valida 1..60 caracteres; lanza 400 ROLE_NAME_INVALID. */
export function normalizeRoleName(raw: unknown): string {
  if (typeof raw !== 'string') throw new RoleNameInvalidError();
  const name = raw.trim();
  if (name.length === 0 || name.length > ROLE_NAME_MAX_LENGTH) throw new RoleNameInvalidError();
  return name;
}
