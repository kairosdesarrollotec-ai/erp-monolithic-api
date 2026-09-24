import { CallHandler, ConflictException, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable, from, of, throwError } from 'rxjs';
import { catchError, concatMap, map } from 'rxjs/operators';
import { createHash } from 'crypto';
import { IdempotencyPort } from '../application/ports/idempotency.port';

export const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000; // 24h - cubre reintentos de red normales.

/**
 * Uso: @UseInterceptors(IdempotencyInterceptor) en un endpoint de comando
 * (POST) que muta estado (Reserva desde PR#6; Consulta desde PR#7).
 *
 * Hallazgo ALTO de revalidacion PR#7 ("reintentos pueden duplicar
 * efectos"): flujo RESERVAR -> EJECUTAR -> COMPLETAR (antes: buscar ->
 * ejecutar -> guardar, con una ventana de carrera en la que dos
 * reintentos concurrentes ejecutaban ambos el comando):
 * - `claim` inserta la clave en estado "en curso" de forma atomica
 *   (UNIQUE en la base). Solo la solicitud que la reserva ejecuta el
 *   comando.
 * - Reintento identico con la clave ya completada -> se devuelve la
 *   respuesta guardada; todavia en curso -> 409 IDEMPOTENCY_KEY_IN_PROGRESS
 *   (el cliente reintenta despues); con otro contenido -> 409
 *   IDEMPOTENCY_KEY_REUSED. En ningun caso se re-ejecuta el comando.
 * - Si el comando falla, la reserva se libera (el cliente puede reintentar
 *   con la misma clave); si tiene exito, se guarda la respuesta.
 * - Garantia resultante: a lo sumo UNA ejecucion por clave. Si el proceso
 *   cae entre ejecutar y completar, la clave queda "en curso" hasta su TTL
 *   (el reintento recibe 409, nunca un duplicado).
 *
 * Header `Idempotency-Key` todavia OPCIONAL: erp-portal-web aun no lo envia
 * en todos los comandos - hacerlo obligatorio romperia el frontend. Brecha
 * documentada en el comentario de respuesta del PR.
 *
 * La clave se guarda con prefijo `${firebaseUid}:` porque este interceptor
 * corre antes de que el handler resuelva el organizationId real; el prefijo
 * evita colisiones entre usuarios.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);

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

    const claim = await this.idempotency.claim({ key: scopedKey, requestHash, ttlMs: IDEMPOTENCY_TTL_MS });
    switch (claim.status) {
      case 'MISMATCH':
        throw new ConflictException({
          code: 'IDEMPOTENCY_KEY_REUSED',
          detail: 'Esta Idempotency-Key ya se uso con una solicitud de contenido distinto.',
        });
      case 'IN_PROGRESS':
        throw new ConflictException({
          code: 'IDEMPOTENCY_KEY_IN_PROGRESS',
          detail: 'Una solicitud con esta Idempotency-Key todavia se esta procesando - reintenta en unos segundos.',
        });
      case 'REPLAY':
        return of(claim.record.responseBody);
      case 'CLAIMED':
        break;
    }

    return next.handle().pipe(
      concatMap((responseBody) => {
        const statusCode = context.switchToHttp().getResponse().statusCode ?? 200;
        return from(this.idempotency.complete({ key: scopedKey, statusCode, responseBody })).pipe(
          map(() => responseBody),
          catchError((completeError) => {
            this.logger.error(
              `No se pudo completar la clave de idempotencia ${scopedKey} tras ejecutar el comando con exito - la clave NO se libera para evitar un reintento duplicado. Requiere reconciliacion manual.`,
              completeError as Error,
            );
            return of(responseBody);
          }),
        );
      }),
      catchError((handlerError) =>
        from(this.idempotency.release(scopedKey)).pipe(concatMap(() => throwError(() => handlerError))),
      ),
    );
  }
}
