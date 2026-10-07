import { createHmac, timingSafeEqual } from 'node:crypto';

/** Acción autorizada por el token: subir (PUT) o leer (GET). */
export type LocalStorageAction = 'write' | 'read';

export interface LocalStorageTokenPayload {
  /** Clave del objeto (ruta relativa dentro del directorio de almacenamiento). */
  key: string;
  action: LocalStorageAction;
  /** Content-Type exigido (solo para `write`). */
  contentType?: string;
  /** Expiración en epoch ms. */
  exp: number;
}

export type LocalStorageTokenErrorReason = 'malformed' | 'bad_signature' | 'expired';

export class LocalStorageTokenError extends Error {
  constructor(readonly reason: LocalStorageTokenErrorReason) {
    super(`Token de almacenamiento local inválido (${reason}).`);
    this.name = 'LocalStorageTokenError';
  }
}

function sign(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body).digest('base64url');
}

export function signLocalStorageToken(payload: LocalStorageTokenPayload, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${body}.${sign(body, secret)}`;
}

export function verifyLocalStorageToken(
  token: string,
  secret: string,
  now: number = Date.now(),
): LocalStorageTokenPayload {
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) throw new LocalStorageTokenError('malformed');
  const [body, signature] = parts;

  const expected = Buffer.from(sign(body, secret));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    throw new LocalStorageTokenError('bad_signature');
  }

  let payload: LocalStorageTokenPayload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as LocalStorageTokenPayload;
  } catch {
    throw new LocalStorageTokenError('malformed');
  }
  if (
    typeof payload?.key !== 'string' ||
    (payload.action !== 'write' && payload.action !== 'read') ||
    typeof payload.exp !== 'number'
  ) {
    throw new LocalStorageTokenError('malformed');
  }
  if (payload.exp <= now) throw new LocalStorageTokenError('expired');
  return payload;
}
