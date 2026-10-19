import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { HrAreaNotFoundError } from '../../domain/hr-administration-errors';
import { areaCodeFromText, normalizeAreaText } from '../../domain/hr-area-rules';
import { HrAreaRepositoryPort } from '../ports/hr-area-repository.port';

export interface ResolveAreaInput {
  operatingCompanyId: string;
  /** Codigo del catalogo (H-02). Si viene, manda sobre `areaId`/`areaName` y debe existir. */
  areaCode?: string | null;
  /** Compatibilidad: id derivado del texto libre. */
  areaId?: string | null;
  /** Compatibilidad: texto libre. */
  areaName?: string | null;
}

export interface ResolvedArea {
  areaId?: string;
  areaName?: string;
  /** `CATALOG` = el area pertenece al catalogo de la empresa; `FREE_TEXT` = texto libre (compatibilidad). */
  source: 'CATALOG' | 'FREE_TEXT' | 'NONE';
}

/**
 * H-02 / DEC-ADP-AREAS-001..003. Unifica como se guarda el area del colaborador para que la regla BR-ADP-002 (maximo 1 persona
 * de vacaciones por area, comparada por `areaId`) no se parta por diferencias de escritura:
 *  1. `areaCode` del catalogo -> `areaId` = codigo, `areaName` = nombre oficial (si no existe: 422 HR_AREA_NOT_FOUND).
 *  2. Texto libre que coincide con el nombre o el codigo de un area del catalogo (sin mayusculas/tildes) -> se usa el catalogo.
 *  3. Texto libre sin coincidencia -> sigue permitido; `areaId` se normaliza (mayusculas, sin tildes, `_`).
 */
@Injectable()
export class HrAreaResolverService {
  constructor(private readonly areas: HrAreaRepositoryPort) {}

  async resolve(input: ResolveAreaInput, tx?: Prisma.TransactionClient): Promise<ResolvedArea> {
    const areaCode = input.areaCode?.trim() ?? '';
    const areaName = input.areaName?.trim() ?? '';
    const areaIdText = input.areaId?.trim() ?? '';
    if (!areaCode && !areaName && !areaIdText) return { source: 'NONE' };

    const catalog = await this.areas.listActive(input.operatingCompanyId, tx);

    if (areaCode) {
      const code = areaCodeFromText(areaCode);
      const found = catalog.find((a) => a.code === code);
      if (!found) throw new HrAreaNotFoundError(areaCode);
      return { areaId: found.code, areaName: found.name, source: 'CATALOG' };
    }

    const nameKey = areaName ? normalizeAreaText(areaName) : '';
    const codeKeys = new Set<string>();
    if (areaIdText) codeKeys.add(areaCodeFromText(areaIdText));
    if (areaName) codeKeys.add(areaCodeFromText(areaName));
    const match =
      (nameKey ? catalog.find((a) => normalizeAreaText(a.name) === nameKey) : undefined) ??
      catalog.find((a) => codeKeys.has(a.code));
    if (match) return { areaId: match.code, areaName: match.name, source: 'CATALOG' };

    const id = areaIdText ? areaCodeFromText(areaIdText) : areaName ? areaCodeFromText(areaName) : undefined;
    return { areaId: id || undefined, areaName: areaName || undefined, source: 'FREE_TEXT' };
  }
}
