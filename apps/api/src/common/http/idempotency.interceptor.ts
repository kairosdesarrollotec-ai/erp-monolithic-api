import { CallHandler, ConflictException, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { createHash } from 'crypto';
import { IdempotencyPort } from '../application/ports/idempotency.port';

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000; // 24h - suficiente para cubrir reintentos de red normales.

/**
 * Hallazgo ALTO de revision PR#6 ("idempotencia no implementada",
 * TDD-RES-001.md seccion 15). Uso: @UseInterceptors(IdempotencyInterceptor)
 * en un endpoint de comando (POST) que muta estado.
 *
 * Header `Idempotency-Key` OPCIONAL hoy (no obligatorio): erp-portal-web
 * (frontend) todavia no lo envia en ningun request - hacerlo obligatorio
 * ahora mismo romperia todos los comandos de Reserva en produccion. Esto
 * queda documentado explicitamente como brecha abierta en el comentario
 * de respuesta de este PR, no es una decision silenciosa. Cuando el
 * header SI llega, se aplica la proteccion completa: mismo Idempotency-Key
 * + mismo cuerpo de solicitud -> se devuelve la respuesta cacheada sin
 * re-ejecutar el comando; mismo Idempotency-Key + cuerpo DISTINTO -> 409
 * (mal uso del header, nunca se re-ejecuta silenciosamente con datos
 * distintos).
 *
 * La clave se guarda en la tabla scopeada por `firebaseUid` (prefijo
 * `${firebaseUid}:${headerKey}`) porque este interceptor corre ANTES de
 * que el handler resuelva el organizationId real via
 * WorkContextAuthorizationService - usar solo el header tal cual
 * permitiria que un actor "adivine" o colisione con la clave de otro
 * usuario.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly idempotency: IdempotencyPort) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const req = context.switchToHttp().getRequest();
    const headerKey = req.headers?.['idempotency-key'];
    const firebaseUid = req.firebaseUid as string | undefined;

    if (!headerKey || typeof headerKey !== 'string' || !firebaseUid) {
      return next.handle();
    }

    const scopedKey = `${firebaseUid}:${headerKey}`;
    const requestHash = createHash('sha256')
      .update(`${req.method} ${req.originalUrl ?? req.url} ${JSON.stringify(req.body ?? {})}`)
      .digest('hex');

    const existing = await this.idempotency.findByKey(scopedKey);
    if (existing) {
      if (existing.requestHash !== requestHash) {
        throw new ConflictException({
          code: 'IDEMPOTENCY_KEY_REUSED',
          detail: 'Esta Idempotency-Key ya se uso con una solicitud de contenido distinto.',
        });
      }
      // Reintento identico: se devuelve la respuesta cacheada, el
      // comando NO se vuelve a ejecutar.
      return of(existing.responseBody);
    }

    return next.handle().pipe(
      tap((responseBody) => {
        void this.idempotency.save({
          key: scopedKey,
          organizationId: null,
          requestHash,
          statusCode: context.switchToHttp().getResponse().statusCode ?? 200,
          responseBody,
          ttlMs: IDEMPOTENCY_TTL_MS,
        });
      }),
    );
  }
}
