import { ConflictException } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';
import { IdempotencyInterceptor } from './idempotency.interceptor';
import { IdempotencyPort } from '../application/ports/idempotency.port';

function buildContext(overrides: {
  headers?: Record<string, string>;
  firebaseUid?: string;
  method?: string;
  url?: string;
  body?: unknown;
}) {
  const req = {
    headers: overrides.headers ?? {},
    firebaseUid: overrides.firebaseUid ?? 'uid-1',
    method: overrides.method ?? 'POST',
    originalUrl: overrides.url ?? '/reservations',
    body: overrides.body ?? { companyId: 'company-1' },
  };
  const res = { statusCode: 201 };
  return {
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => res,
    }),
  } as any;
}

describe('IdempotencyInterceptor', () => {
  it('ejecuta el handler normalmente si no llega el header Idempotency-Key (opcional hoy)', async () => {
    const idempotency: jest.Mocked<IdempotencyPort> = {
      findByKey: jest.fn(),
      save: jest.fn(),
    };
    const interceptor = new IdempotencyInterceptor(idempotency);
    const ctx = buildContext({ headers: {} });
    const next = { handle: jest.fn().mockReturnValue(of({ id: 'res-1' })) };

    const result$ = await interceptor.intercept(ctx, next as any);
    const result = await firstValueFrom(result$);

    expect(idempotency.findByKey).not.toHaveBeenCalled();
    expect(result).toEqual({ id: 'res-1' });
  });

  it('ejecuta el comando y guarda la respuesta cuando la clave es nueva', async () => {
    const idempotency: jest.Mocked<IdempotencyPort> = {
      findByKey: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const interceptor = new IdempotencyInterceptor(idempotency);
    const ctx = buildContext({ headers: { 'idempotency-key': 'key-1' } });
    const next = { handle: jest.fn().mockReturnValue(of({ id: 'res-1' })) };

    const result$ = await interceptor.intercept(ctx, next as any);
    await firstValueFrom(result$);

    expect(next.handle).toHaveBeenCalled();
    expect(idempotency.save).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'uid-1:key-1', statusCode: 201, responseBody: { id: 'res-1' } }),
    );
  });

  it('devuelve la respuesta cacheada sin re-ejecutar el comando ante un reintento identico', async () => {
    const idempotency: jest.Mocked<IdempotencyPort> = {
      findByKey: jest.fn(),
      save: jest.fn(),
    };
    const interceptor = new IdempotencyInterceptor(idempotency);
    const ctx = buildContext({ headers: { 'idempotency-key': 'key-1' } });
    const next = { handle: jest.fn().mockReturnValue(of({ id: 'res-1' })) };

    // Calcular el hash real que el interceptor calcularia para esta request,
    // para simular que ya existe un registro con el MISMO hash.
    const crypto = require('crypto');
    const req = ctx.switchToHttp().getRequest();
    const expectedHash = crypto
      .createHash('sha256')
      .update(`${req.method} ${req.originalUrl} ${JSON.stringify(req.body ?? {})}`)
      .digest('hex');
    idempotency.findByKey.mockResolvedValue({
      requestHash: expectedHash,
      statusCode: 201,
      responseBody: { id: 'res-1', cached: true },
    });

    const result$ = await interceptor.intercept(ctx, next as any);
    const result = await firstValueFrom(result$);

    expect(next.handle).not.toHaveBeenCalled();
    expect(result).toEqual({ id: 'res-1', cached: true });
  });

  it('rechaza con 409 si la misma Idempotency-Key se reusa con un cuerpo distinto', async () => {
    const idempotency: jest.Mocked<IdempotencyPort> = {
      findByKey: jest.fn().mockResolvedValue({
        requestHash: 'hash-de-otra-solicitud-distinta',
        statusCode: 201,
        responseBody: { id: 'res-1' },
      }),
      save: jest.fn(),
    };
    const interceptor = new IdempotencyInterceptor(idempotency);
    const ctx = buildContext({ headers: { 'idempotency-key': 'key-1' }, body: { companyId: 'otra-empresa' } });
    const next = { handle: jest.fn().mockReturnValue(of({ id: 'res-2' })) };

    await expect(interceptor.intercept(ctx, next as any)).rejects.toBeInstanceOf(ConflictException);
    expect(next.handle).not.toHaveBeenCalled();
  });

  it('aisla la clave por usuario (mismo Idempotency-Key, distinto firebaseUid, no colisiona)', async () => {
    const idempotency: jest.Mocked<IdempotencyPort> = {
      findByKey: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const interceptor = new IdempotencyInterceptor(idempotency);
    const ctx = buildContext({ headers: { 'idempotency-key': 'key-1' }, firebaseUid: 'uid-2' });
    const next = { handle: jest.fn().mockReturnValue(of({ id: 'res-1' })) };

    const result$ = await interceptor.intercept(ctx, next as any);
    await firstValueFrom(result$);

    expect(idempotency.findByKey).toHaveBeenCalledWith('uid-2:key-1');
  });
});
