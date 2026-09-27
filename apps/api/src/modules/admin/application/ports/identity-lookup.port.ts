/**
 * Puerto hacia el proveedor de identidad (Firebase Authentication,
 * TD-008 del TDD) - ADM-01 necesita resolver un correo a un
 * `firebaseUid` (para asignar), provisionarlo si no existe, y resolver
 * `firebaseUid`s a correos (para mostrarlos en la bandeja), sin que la
 * capa de aplicacion dependa directamente de `firebase-admin`.
 */
export abstract class IdentityLookupPort {
  abstract findUidByEmail(email: string): Promise<string | null>;

  /**
   * Crea una cuenta en Firebase Authentication con la contraseña inicial
   * dada (mínimo 8 caracteres). El usuario inicia sesión con esa contraseña
   * y el guard TR-02 lo redirige a /activar-cuenta donde debe cambiarla
   * obligatoriamente (requiresPasswordChange: true) y enrolar MFA.
   *
   * Si la cuenta ya existe en Firebase, lanza ConflictException.
   */
  abstract provisionUser(email: string, password: string): Promise<{ uid: string }>;

  /**
   * Resuelve el correo de cada uid dado, para mostrarlo en la bandeja de
   * ADM-01 (columna "Correo"). Un uid que ya no existe en el proveedor de
   * identidad (cuenta eliminada) devuelve `null` para esa entrada, en vez
   * de fallar toda la lista.
   */
  abstract findEmailsByUids(uids: string[]): Promise<Record<string, string | null>>;
}
