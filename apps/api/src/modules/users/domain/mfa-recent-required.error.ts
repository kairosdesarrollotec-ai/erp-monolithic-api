import { DomainForbiddenError } from '../../../common/domain/domain-errors';

/**
 * SEC-F4 (TDD-00 §8.4): una operacion critica exige MFA completado en los
 * ultimos 5 minutos. El front reacciona a este codigo abriendo el reto TR-03
 * y reintentando con un token renovado.
 */
export class MfaRecentRequiredError extends DomainForbiddenError {
  readonly code = 'MFA_RECENT_REQUIRED';

  constructor(maxAgeSeconds: number) {
    super(
      'Esta operacion requiere autenticacion multifactor reciente (ultimos 5 minutos).',
      { maxAgeSeconds },
    );
  }
}
