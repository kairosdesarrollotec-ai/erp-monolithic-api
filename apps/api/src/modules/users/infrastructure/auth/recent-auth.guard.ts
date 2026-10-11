import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedRequest } from './firebase-auth.guard';
import { getAuth } from 'firebase-admin/auth';
import { initFirebaseAdmin } from '../../../../config/firebase-admin.config';

export const RECENT_AUTH_SECONDS_KEY = 'recentAuthSeconds';

// Marks an endpoint as requiring MFA completed within `seconds` seconds.
// TDD-00 §8.4: critical operations require MFA in the last 5 minutes (300 s).
export const RecentAuth = (seconds: number) =>
  SetMetadata(RECENT_AUTH_SECONDS_KEY, seconds);

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
      throw new ForbiddenException('MFA reciente requerida para esta operacion.');
    }

    initFirebaseAdmin();
    const decoded = await getAuth().verifyIdToken(header.slice('Bearer '.length));

    const nowSeconds = Math.floor(Date.now() / 1000);
    const authAge = nowSeconds - (decoded.auth_time ?? 0);

    // Require that second factor was present and auth is recent enough.
    const hasMfa = !!decoded.firebase?.sign_in_second_factor;
    if (!hasMfa || authAge > seconds) {
      throw new ForbiddenException(
        'Esta operacion requiere autenticacion multifactor reciente (ultimos 5 minutos).',
      );
    }

    return true;
  }
}
