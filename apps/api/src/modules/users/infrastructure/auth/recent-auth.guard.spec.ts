import 'reflect-metadata';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { getAuth } from 'firebase-admin/auth';
import { MfaRecentRequiredError } from '../../domain/mfa-recent-required.error';
import { RECENT_AUTH_SECONDS_KEY, RecentAuthGuard } from './recent-auth.guard';

// moduleNameMapper redirige firebase-admin/auth y config/firebase-admin.config a stubs.
describe('RecentAuthGuard (SEC-F4: MFA reciente <= 5 min)', () => {
  const NOW = 1_800_000_000;
  const verifyIdToken = jest.fn();
  const reflector = new Reflector();
  let seconds: number | undefined;
  let guard: RecentAuthGuard;

  function context(headers: Record<string, string>, firebaseUid?: string): ExecutionContext {
    const handler = () => undefined;
    if (seconds !== undefined) Reflect.defineMetadata(RECENT_AUTH_SECONDS_KEY, seconds, handler);
    return {
      getHandler: () => handler,
      switchToHttp: () => ({ getRequest: () => ({ headers, firebaseUid }) }),
    } as unknown as ExecutionContext;
  }

  const bearer = { authorization: 'Bearer tok' };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(NOW * 1000);
    (getAuth as jest.Mock).mockReturnValue({ verifyIdToken });
    seconds = 300;
    guard = new RecentAuthGuard(reflector);
  });
  afterEach(() => jest.restoreAllMocks());

  it('deja pasar si el endpoint no declara @RecentAuth', async () => {
    seconds = undefined;
    await expect(guard.canActivate(context({}))).resolves.toBe(true);
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  it('permite con segundo factor y auth_time dentro de 5 minutos (y verifica revocacion)', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'u1', auth_time: NOW - 299, firebase: { sign_in_second_factor: 'totp' } });
    await expect(guard.canActivate(context(bearer, 'u1'))).resolves.toBe(true);
    expect(verifyIdToken).toHaveBeenCalledWith('tok', true);
  });

  it('rechaza con MFA_RECENT_REQUIRED (403) si auth_time supera 5 minutos', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'u1', auth_time: NOW - 301, firebase: { sign_in_second_factor: 'totp' } });
    const error = await guard.canActivate(context(bearer, 'u1')).catch((e) => e);
    expect(error).toBeInstanceOf(MfaRecentRequiredError);
    expect(error.code).toBe('MFA_RECENT_REQUIRED');
    expect(error.httpStatus).toBe(403);
    expect(error.extra).toEqual({ maxAgeSeconds: 300 });
  });

  it('rechaza si el token no trae segundo factor aunque sea reciente', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'u1', auth_time: NOW - 5, firebase: { sign_in_provider: 'password' } });
    await expect(guard.canActivate(context(bearer, 'u1'))).rejects.toBeInstanceOf(MfaRecentRequiredError);
  });

  it('rechaza si falta auth_time (falla cerrado)', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'u1', firebase: { sign_in_second_factor: 'totp' } });
    await expect(guard.canActivate(context(bearer, 'u1'))).rejects.toBeInstanceOf(MfaRecentRequiredError);
  });

  it('rechaza un auth_time en el futuro (token manipulado o reloj roto)', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'u1', auth_time: NOW + 3600, firebase: { sign_in_second_factor: 'totp' } });
    await expect(guard.canActivate(context(bearer, 'u1'))).rejects.toBeInstanceOf(MfaRecentRequiredError);
  });

  it('401 sin cabecera Authorization', async () => {
    await expect(guard.canActivate(context({}))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('401 si el token es invalido o fue revocado', async () => {
    verifyIdToken.mockRejectedValue(new Error('auth/id-token-revoked'));
    await expect(guard.canActivate(context(bearer, 'u1'))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('401 si el token pertenece a otro usuario que el autenticado por FirebaseAuthGuard', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'otro', auth_time: NOW - 5, firebase: { sign_in_second_factor: 'totp' } });
    await expect(guard.canActivate(context(bearer, 'u1'))).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
