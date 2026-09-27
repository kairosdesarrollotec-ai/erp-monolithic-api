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
   * Crea una cuenta en Firebase Authentication para el correo dado y
   * retorna el uid asignado junto con un enlace de restablecimiento de
   * contrasena que el administrador comparte con el usuario. El usuario
   * usa ese enlace para establecer su contrasena antes de su primer
   * acceso; luego completa el enrolamiento MFA en TR-02.
   *
   * Si la cuenta ya existe en Firebase, lanza ConflictException para que
   * el caller la maneje: en ADM-01 se usa el uid existente y no se
   * re-emite el enlace.
   */
  abstract provisionUser(email: string): Promise<{ uid: string; passwordResetLink: string }>;

  /**
   * Resuelve el correo de cada uid dado, para mostrarlo en la bandeja de
   * ADM-01 (columna "Correo"). Un uid que ya no existe en el proveedor de
   * identidad (cuenta eliminada) devuelve `null` para esa entrada, en vez
   * de fallar toda la lista.
   */
  abstract findEmailsByUids(uids: string[]): Promise<Record<string, string | null>>;
}
