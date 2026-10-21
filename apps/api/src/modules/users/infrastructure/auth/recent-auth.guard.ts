import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedRequest } from './firebase-auth.guard';
import { getAuth } from 'firebase-admin/auth';
import { initFirebaseAdmin } from '../../../../config/firebase-admin.config';
import { MfaRecentRequiredError } from '../../domain/mfa-recent-required.error';

export const RECENT_AUTH_SECONDS_KEY = 'recentAuthSeconds';

// Marks an endpoint as requiring MFA completed within `seconds` seconds.
// TDD-00 §8.4: critical operations require MFA in the last 5 minutes (300 s).
export const RecentAuth = (seconds: number) =>
  SetMetadata(RECENT_AUTH_SECONDS_KEY, seconds);

// SEC-F4: ventana por defecto de MFA reciente para operaciones criticas.
export const CRITICAL_OPERATION_MFA_MAX_AGE_SECONDS = 300;

/**
 * Guard de "MFA reciente" (SEC-F4). Se aplica DESPUES de FirebaseAuthGuard.
 * Verifica el ID token (firma, expiracion y revocacion) y exige:
 *  - `firebase.sign_in_second_factor` presente (el login uso segundo factor), y
 *  - `auth_time` dentro de la ventana (por defecto 300 s).
 * Falla cerrado: sin token, token invalido, sin factor, sin auth_time o con
 * auth_time en el futuro -> nunca pasa. El error de MFA es 403
 * `MFA_RECENT_REQUIRED` ({statusCode, code, detail}); un token invalido es 401.
 */
@Injectable()
export class RecentAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const seconds = this.reflector.get<number>(
      RECENT_AUTH_SECONDS_KEY,
      context.getHandler(),
    );
    if (seconds === undefined) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Falta el token de autenticacion.');
    }

    let decoded: Awaited<ReturnType<ReturnType<typeof getAuth>['verifyIdToken']>>;
    try {
      initFirebaseAdmin();
      // checkRevoked=true: un token revocado (baja, incidente) no sirve para una operacion critica.
      decoded = await getAuth().verifyIdToken(header.slice('Bearer '.length), true);
    } catch {
      throw new UnauthorizedException('Token de autenticacion invalido o expirado.');
    }

    // El token debe ser del mismo usuario que ya autentico FirebaseAuthGuard.
    if (request.firebaseUid && decoded.uid !== request.firebaseUid) {
      throw new UnauthorizedException('Token de autenticacion invalido o expirado.');
    }

    const authTime = typeof decoded.auth_time === 'number' ? decoded.auth_time : null;
    const nowSeconds = Math.floor(Date.now() / 1000);
    const hasMfa = !!decoded.firebase?.sign_in_second_factor;
    const isRecent = authTime !== null && authTime <= nowSeconds + 60 && nowSeconds - authTime <= seconds;
    if (!hasMfa || !isRecent) {
      throw new MfaRecentRequiredError(seconds);
    }

    return true;
  }
}
