/**
 * Puerto para conocer el correo de la cuenta de acceso de un usuario. El correo SOLO se usa dentro del servidor para
 * vincular al usuario con su ficha de colaborador (`GET /me/employee`); nunca se devuelve en una respuesta.
 * Best-effort: si no se puede resolver devuelve null.
 */
export abstract class UserAccountEmailPort {
  abstract findEmail(firebaseUid: string): Promise<string | null>;
  /**
   * Cuenta de acceso (uid) cuyo correo coincide con `email` (comparación sin distinguir mayúsculas), o null si no hay.
   * Se usa para vincular usuario y ficha por correo (DEC-ADP-LINK-EMAIL-001). Best-effort: errores del proveedor -> null.
   */
  abstract findUidByEmail(email: string): Promise<string | null>;
}
