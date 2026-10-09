import { Request, Response, NextFunction } from 'express';

/**
 * Middleware que aplica cabeceras de seguridad HTTP estándar (F7 / TDD-00 §8.1)
 * sin añadir dependencias externas conflictivas con el árbol de dependencias del workspace.
 */
export function securityHeadersMiddleware(req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  res.setHeader('X-Download-Options', 'noopen');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Origin-Agent-Cluster', '?1');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-XSS-Protection', '0');
  // F7 — CSP restrictiva para una API JSON pura (TDD-00 §8.1): sin HTML, sin scripts,
  // sin recursos embebidos. Previene OWASP A05 en clientes que procesen la respuesta
  // directamente (ej. herramientas de debug, proxies).
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'none'; frame-ancestors 'none'",
  );
  next();
}
