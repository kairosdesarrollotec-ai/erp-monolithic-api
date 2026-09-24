import { BadRequestException } from '@nestjs/common';
import { IfMatchRequiredError } from '../../modules/reservations/domain/reservation-errors';

/**
 * Hallazgo medio de revision PR#6 ("If-Match no cumple semantica
 * robusta"): parser reusable para el header `If-Match` cuando se usa
 * para optimistic concurrency por numero de version entero (RFC 9110
 * 13.1.2 - strong validator). El parser anterior, inline en
 * reservations.controller.ts, quitaba comillas con un replace libre,
 * aceptaba 0 y negativos, y usaba 400 tanto para header ausente como
 * para valor invalido.
 *
 * Reglas de este parser:
 * - Header ausente/vacio -> IfMatchRequiredError (428 Precondition
 *   Required, RFC 6585) - "falta la precondicion", no "payload invalido".
 * - Header presente pero mal formado (sin comillas, no numerico, cero o
 *   negativo) -> 400 Bad Request - eso si es un payload invalido.
 * - Formato exigido: ETag fuerte con un entero positivo entre comillas,
 *   ej. `"3"`. No se aceptan ETags debiles (`W/"3"`) porque el uso aqui
 *   es comparacion exacta de version, no cacheo.
 */
const STRONG_INTEGER_ETAG = /^"([1-9]\d*)"$/;

export function parseVersionIfMatch(ifMatch: string | undefined): number {
  if (!ifMatch || ifMatch.trim().length === 0) {
    throw new IfMatchRequiredError();
  }
  const match = STRONG_INTEGER_ETAG.exec(ifMatch.trim());
  if (!match) {
    throw new BadRequestException({
      code: 'IF_MATCH_INVALID',
      detail:
        'El header If-Match debe ser un ETag fuerte con un numero de version entero positivo, ej. "3".',
    });
  }
  return Number(match[1]);
}
