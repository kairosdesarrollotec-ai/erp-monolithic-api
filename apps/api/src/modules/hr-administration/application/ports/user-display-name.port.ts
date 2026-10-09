/**
 * Puerto para resolver el nombre visible de usuarios (quien autorizó un permiso o una salida a campo).
 * Best-effort: si no se puede resolver devuelve null; nunca debe bloquear la operación.
 * Autorizar NUNCA se decide por nombre (BR-ADP-003/004): el nombre solo se guarda para trazabilidad.
 */
export abstract class UserDisplayNamePort {
  abstract findDisplayName(firebaseUid: string): Promise<string | null>;
}
