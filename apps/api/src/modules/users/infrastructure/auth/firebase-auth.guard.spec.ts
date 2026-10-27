import 'reflect-metadata';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { getAuth } from 'firebase-admin/auth';
import { IS_PUBLIC_KEY } from '../../../../common/decorators/public.decorator';
import { FirebaseAuthGuard, AuthenticatedRequest } from './firebase-auth.guard';

describe('FirebaseAuthGuard (P3: Revocación de sesión en servidor checkRevoked)', () => {
  const verifyIdToken = jest.fn();
  const reflector = new Reflector();
  let guard: FirebaseAuthGuard;
  let isPublic = false;

  function context(headers: Record<string, string>, reqPatch: Partial<AuthenticatedRequest> = {}): ExecutionContext {
    const handler = () => undefined;
    const cls = class TestClass {};
    if (isPublic) {
      Reflect.defineMetadata(IS_PUBLIC_KEY, true, handler);
    }
    const request: AuthenticatedRequest = { headers, ...reqPatch } as unknown as AuthenticatedRequest;
    return {
      getHandler: () => handler,
      getClass: () => cls,
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
  }

  const bearer = { authorization: 'Bearer valid-id-token' };

  beforeEach(() => {
    jest.clearAllMocks();
    isPublic = false;
    (getAuth as jest.Mock).mockReturnValue({ verifyIdToken });
    guard = new FirebaseAuthGuard(reflector);
  });

  afterEach(() => jest.restoreAllMocks());

  it('permite el acceso si el endpoint o controlador es público (@Public)', async () => {
    isPublic = true;
    const ctx = context({});
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  it('lanza UnauthorizedException (401) si falta la cabecera Authorization', async () => {
    const ctx = context({});
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  it('lanza UnauthorizedException (401) si la cabecera Authorization no es Bearer', async () => {
    const ctx = context({ authorization: 'Basic dXNlcjpwYXNz' });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  it('llama a verifyIdToken con checkRevoked = true y propaga datos de usuario en la petición', async () => {
    verifyIdToken.mockResolvedValue({
      uid: 'uid-user-123',
      email: 'user@veloxrent.pe',
      name: 'Usuario Prueba',
    });

    const req: Partial<AuthenticatedRequest> = {};
    const ctx = context(bearer, req);

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(verifyIdToken).toHaveBeenCalledWith('valid-id-token', true);

    const httpReq = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    expect(httpReq.firebaseUid).toBe('uid-user-123');
    expect(httpReq.email).toBe('user@veloxrent.pe');
    expect(httpReq.displayName).toBe('Usuario Prueba');
  });

  it('lanza UnauthorizedException (401) si el token fue revocado en el servidor', async () => {
    verifyIdToken.mockRejectedValue(new Error('auth/id-token-revoked'));
    const ctx = context(bearer);
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(verifyIdToken).toHaveBeenCalledWith('valid-id-token', true);
  });

  it('lanza UnauthorizedException (401) si el token expiró o es inválido', async () => {
    verifyIdToken.mockRejectedValue(new Error('auth/id-token-expired'));
    const ctx = context(bearer);
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(verifyIdToken).toHaveBeenCalledWith('valid-id-token', true);
  });
});
