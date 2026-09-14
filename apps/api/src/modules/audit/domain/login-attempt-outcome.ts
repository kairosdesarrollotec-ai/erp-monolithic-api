/**
 * Resultado de un intento de inicio de sesion (TR-01).
 * Fuente: PANTALLAS-V2-B-TRANSVERSAL.md TR-01, punto 11 "Eventos auditables"
 * - "Intento de login (exito/fallo), sin registrar la contrasena".
 */
export type LoginAttemptOutcome = 'SUCCESS' | 'FAILURE';
