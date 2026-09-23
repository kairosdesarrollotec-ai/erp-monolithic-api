/**
 * Puerto hacia el proveedor de identidad (Firebase Authentication,
 * TD-008 del TDD) - ADM-01 necesita resolver un correo a un
 * `firebaseUid` (para asignar) y `firebaseUid`s a correos (para
 * mostrarlos en la bandeja de usuarios), sin que la capa de aplicacion
 * dependa directamente de `firebase-admin`.
 *
 * LIMITACION CONOCIDA, documentada en vez de ocultada: ADM-01 (contrato
 * "Agregar usuario") no crea cuentas nuevas de Firebase Authentication
 * desde esta pantalla - `findUidByEmail` solo resuelve un usuario que ya
 * existe ahi (el alta de la cuenta en si sigue siendo un paso previo,
 * fuera de este modulo). Lo que ADM-01 SI hace es asignarle empresa/
 * sede/rol dentro de KAIROS a un usuario que ya se autentico alguna vez.
 */
export abstract class IdentityLookupPort {
  abstract findUidByEmail(email: string): Promise<string | null>;

  /**
   * Resuelve el correo de cada uid dado, para mostrarlo en la bandeja de
   * ADM-01 (columna "Correo"). Un uid que ya no existe en el proveedor de
   * identidad (cuenta eliminada) devuelve `null` para esa entrada, en vez
   * de fallar toda la lista.
   */
  abstract findEmailsByUids(uids: string[]): Promise<Record<string, string | null>>;
}
