/**
 * Puerto para conocer el correo de la cuenta de acceso de un usuario. El correo SOLO se usa dentro del servidor para
 * vincular al usuario con su ficha de colaborador (`GET /me/employee`); nunca se devuelve en una respuesta.
 * Best-effort: si no se puede resolver devuelve null.
 */
export abstract class UserAccountEmailPort {
  abstract findEmail(firebaseUid: string): Promise<string | null>;
}
