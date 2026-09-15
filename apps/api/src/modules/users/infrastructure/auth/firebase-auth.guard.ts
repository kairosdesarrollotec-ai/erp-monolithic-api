import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { getAuth } from 'firebase-admin/auth';
import { initFirebaseAdmin } from '../../../../config/firebase-admin.config';

export interface AuthenticatedRequest extends Request {
  firebaseUid?: string;
}

/**
 * Verifica el ID token de Firebase Auth enviado como
 * "Authorization: Bearer <idToken>". Los endpoints de TR-02 son los
 * primeros en requerir un usuario autenticado (el endpoint de auditoria
 * de TR-01 es publico) - initFirebaseAdmin() ya existia pero no estaba
 * conectado a ningun guard todavia.
 */
@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization;

    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Falta el token de autenticacion.');
    }

    const idToken = header.slice('Bearer '.length);

    try {
      initFirebaseAdmin();
      const decoded = await getAuth().verifyIdToken(idToken);
      request.firebaseUid = decoded.uid;
      return true;
    } catch {
      throw new UnauthorizedException('Token de autenticacion invalido o expirado.');
    }
  }
}
