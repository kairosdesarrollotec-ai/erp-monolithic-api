import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { getAuth } from 'firebase-admin/auth';
import { initFirebaseAdmin } from '../../../../config/firebase-admin.config';
import { IS_PUBLIC_KEY } from '../../../../common/decorators/public.decorator';

export interface AuthenticatedRequest extends Request {
  firebaseUid?: string;
  email?: string;
  displayName?: string;
}

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization;

    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Falta el token de autenticacion.');
    }

    const idToken = header.slice('Bearer '.length);

    try {
      initFirebaseAdmin();
      const decoded = await getAuth().verifyIdToken(idToken, true);
      request.firebaseUid = decoded.uid;
      request.email = decoded.email;
      request.displayName =
        (decoded.name as string | undefined) ??
        ((decoded as Record<string, unknown>).displayName as string | undefined);
      return true;
    } catch {
      throw new UnauthorizedException('Token de autenticacion invalido o expirado.');
    }
  }
}
