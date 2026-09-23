import { ConflictException } from '@nestjs/common';
import { firstValueFrom, of, throwError } from 'rxjs';
import { IdempotencyInterceptor } from './idempotency.interceptor';
import { IdempotencyClaimResult, IdempotencyPort } from '../application/ports/idempotency.port';

function buildContext(overrides: {
  headers?: Record<string, string>;
  firebaseUid?: string;
  body?: unknown;
}) {
  const req = {
    headers: overrides.headers ?? {},
    firebaseUid: overrides.firebaseUid ?? 'uid-1',
    method: 'POST',
    originalUrl: '/reservations',
    body: overrides.body ?? { companyId: 'company-1' },
  };
  const res = { statusCode: 201 };
  return {
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
  } as any;
}

function buildPort(claim: IdempotencyClaimResult): jest.Mocked<IdempotencyPort> {
  return {
    claim: jest.fn().mockResolvedValue(claim),
    complete: jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockResolvedValue(undefined),
  };
}

describe('IdempotencyInterceptor', () => {
  it('ejecuta el handler normalmente si no llega el header Idempotency-Key (opcional hoy)', async () => {
    const port = buildPort({ status: 'CLAIMED' });
    const next = { handle: jest.fn().mockReturnValue(of({ id: 'res-1' })) };

    const result = await firstValueFrom(await new IdempotencyInterceptor(port).intercept(buildContext({}), next as any));

    expect(port.claim).not.toHaveBeenCalled();
    expect(result).toEqual({ id: 'res-1' });
  });

  it('reserva la clave ANTES de ejecutar y guarda la respuesta al terminar', async () => {
    const port = buildPort({ status: 'CLAIMED' });
    const calls: string[] = [];
    port.claim.mockImplementation(async () => {
      calls.push('claim');
      return { status: 'CLAIMED' };
    });
    const next = {
      handle: jest.fn().mockImplementation(() => {
        calls.push('handle');
        return of({ id: 'res-1' });
      }),
    };

    const ctx = buildContext({ headers: { 'idempotency-key': 'key-1' } });
    await firstValueFrom(await new IdempotencyInterceptor(port).intercept(ctx, next as any));

    expect(calls).toEqual(['claim', 'handle']);
    expect(port.claim).toHaveBeenCalledWith(expect.objectContaining({ key: 'uid-1:key-1' }));
    expect(port.complete).toHaveBeenCalledWith({ key: 'uid-1:key-1', statusCode: 201, responseBody: { id: 'res-1' } });
    expect(port.release).not.toHaveBeenCalled();
  });

  it('devuelve la respuesta guardada sin re-ejecutar el comando ante un reintento identico ya completado', async () => {
    const port = buildPort({
      status: 'REPLAY',
      record: { requestHash: 'h', statusCode: 201, responseBody: { id: 'res-1', cached: true } },
    });
    const next = { handle: jest.fn() };

    const ctx = buildContext({ headers: { 'idempotency-key': 'key-1' } });
    const result = await firstValueFrom(await new IdempotencyInterceptor(port).intercept(ctx, next as any));

    expect(next.handle).not.toHaveBeenCalled();
    expect(result).toEqual({ id: 'res-1', cached: true });
  });

  it('rechaza con 409 IDEMPOTENCY_KEY_IN_PROGRESS si otra solicitud con la misma clave sigue en curso (carrera)', async () => {
    const port = buildPort({ status: 'IN_PROGRESS' });
    const next = { handle: jest.fn() };

    const ctx = buildContext({ headers: { 'idempotency-key': 'key-1' } });
    const error = await new IdempotencyInterceptor(port).intercept(ctx, next as any).catch((e) => e);

    expect(error).toBeInstanceOf(ConflictException);
    expect(error.getResponse()).toEqual(expect.objectContaining({ code: 'IDEMPOTENCY_KEY_IN_PROGRESS' }));
    expect(next.handle).not.toHaveBeenCalled();
  });

  it('rechaza con 409 IDEMPOTENCY_KEY_REUSED si la misma clave se reusa con un cuerpo distinto', async () => {
    const port = buildPort({ status: 'MISMATCH' });
    const next = { handle: jest.fn() };

    const ctx = buildContext({ headers: { 'idempotency-key': 'key-1' }, body: { companyId: 'otra' } });
    const error = await new IdempotencyInterceptor(port).intercept(ctx, next as any).catch((e) => e);

    expect(error.getResponse()).toEqual(expect.objectContaining({ code: 'IDEMPOTENCY_KEY_REUSED' }));
    expect(next.handle).not.toHaveBeenCalled();
  });

  it('libera la reserva si el comando falla, para permitir el reintento', async () => {
    const port = buildPort({ status: 'CLAIMED' });
    const failure = new Error('fallo de negocio');
    const next = { handle: jest.fn().mockReturnValue(throwError(() => failure)) };

    const ctx = buildContext({ headers: { 'idempotency-key': 'key-1' } });
    const result$ = await new IdempotencyInterceptor(port).intercept(ctx, next as any);

    await expect(firstValueFrom(result$)).rejects.toBe(failure);
    expect(port.release).toHaveBeenCalledWith('uid-1:key-1');
    expect(port.complete).not.toHaveBeenCalled();
  });

  it('calcula el mismo hash para el mismo contenido y distinto para contenido distinto', async () => {
    const port = buildPort({ status: 'CLAIMED' });
    const next = { handle: jest.fn().mockReturnValue(of({})) };
    const interceptor = new IdempotencyInterceptor(port);

    await firstValueFrom(await interceptor.intercept(buildContext({ headers: { 'idempotency-key': 'k' }, body: { a: 1 } }), next as any));
    await firstValueFrom(await interceptor.intercept(buildContext({ headers: { 'idempotency-key': 'k' }, body: { a: 1 } }), next as any));
    await firstValueFrom(await interceptor.intercept(buildContext({ headers: { 'idempotency-key': 'k' }, body: { a: 2 } }), next as any));

    const hashes = port.claim.mock.calls.map(([input]) => input.requestHash);
    expect(hashes[0]).toBe(hashes[1]);
    expect(hashes[2]).not.toBe(hashes[0]);
  });

  it('aisla la clave por usuario (mismo Idempotency-Key, distinto firebaseUid, no colisiona)', async () => {
    const port = buildPort({ status: 'CLAIMED' });
    const next = { handle: jest.fn().mockReturnValue(of({})) };

    const ctx = buildContext({ headers: { 'idempotency-key': 'key-1' }, firebaseUid: 'uid-2' });
    await firstValueFrom(await new IdempotencyInterceptor(port).intercept(ctx, next as any));

    expect(port.claim).toHaveBeenCalledWith(expect.objectContaining({ key: 'uid-2:key-1' }));
  });
});
