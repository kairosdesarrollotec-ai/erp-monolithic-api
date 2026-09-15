/**
 * Estado de "primer acceso" de un usuario (TR-02).
 * Fuente: PANTALLAS-V2-B-TRANSVERSAL.md TR-02 - un usuario esta en primer
 * acceso mientras tenga una contrasena temporal sin cambiar y/o no haya
 * enrolado su segundo factor (MFA TOTP via Firebase Multi-Factor).
 *
 * PROPUESTO junto con UserProfile (schema.prisma) - ver
 * docs/decision-log.md, pendiente de validacion formal del equipo.
 */
export interface ActivationStatus {
  requiresPasswordChange: boolean;
  requiresMfaEnrollment: boolean;
}
