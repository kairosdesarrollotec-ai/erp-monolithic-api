export interface LoginFailureScope {
  organizationId: string;
  operatingCompanyId: string;
  branchId: string;
}

/** B8: lectura de la racha de fallos de login y emision de la alerta a Administracion. */
export abstract class LoginFailureTrackerPort {
  /** Intentos del identificador desde `since`, del mas nuevo al mas viejo. */
  abstract listAttemptsSince(email: string, since: Date, limit: number): Promise<Array<{ outcome: 'SUCCESS' | 'FAILURE' }>>;
  abstract alertAlreadyRaised(email: string, since: Date): Promise<boolean>;
  /**
   * Resuelve las organizaciones/sedes de la cuenta (email -> uid de Firebase -> asignaciones activas).
   * Vacio si el correo no corresponde a una cuenta conocida.
   */
  abstract resolveScopes(email: string): Promise<LoginFailureScope[]>;
  /** Registra el evento de seguridad (por organizacion; 'UNKNOWN' si no hay cuenta) y la alerta ADMINISTRACION. */
  abstract raiseAlert(input: { email: string; failures: number; windowMinutes: number; scopes: LoginFailureScope[]; now: Date }): Promise<void>;
}
