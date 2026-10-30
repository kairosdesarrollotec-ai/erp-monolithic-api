import { DomainBadRequestError } from './domain-errors';

/** R-6 (29-oct-2026): enlaces externos solo http/https (rechaza javascript:, rutas relativas, vacios). */
export class InvalidHttpUrlError extends DomainBadRequestError {
  readonly code = 'INVALID_URL';

  constructor(detail = 'Indica un enlace valido que empiece con http:// o https://.') {
    super(detail);
  }
}

export function assertHttpUrl(value: string | null | undefined): string {
  const trimmed = (value ?? '').trim();
  if (!trimmed) throw new InvalidHttpUrlError();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new InvalidHttpUrlError();
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new InvalidHttpUrlError();
  }
  return trimmed;
}
