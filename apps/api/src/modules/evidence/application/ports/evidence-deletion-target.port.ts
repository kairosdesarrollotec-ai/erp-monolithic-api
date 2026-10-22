import type { Prisma } from '@prisma/client';
import type { EvidenceDeletionTargetKind, EvidenceSnapshot } from '../../domain/evidence-deletion-types';
import type { EvidenceDeletionScope } from './evidence-deletion-request-repository.port';

/**
 * Puerto hacia el borrado REAL de la evidencia de Alquiler / Devolucion. La implementacion delega en los servicios de remocion
 * de cada modulo (la misma regla que el borrado directo historico): este modulo no duplica ninguna logica de evidencia.
 */
export abstract class EvidenceDeletionTargetPort {
  /** Verifica expediente, estado y existencia (404 / 409 del modulo dueño) y devuelve la foto fija del registro. */
  abstract locate(
    kind: EvidenceDeletionTargetKind,
    parentId: string,
    evidenceId: string,
    scope: EvidenceDeletionScope,
    tx?: Prisma.TransactionClient,
  ): Promise<EvidenceSnapshot>;

  /** Ejecuta el borrado (dentro de `tx`): relanza los mismos errores del modulo dueño si el expediente ya no lo admite. */
  abstract remove(
    kind: EvidenceDeletionTargetKind,
    parentId: string,
    evidenceId: string,
    scope: EvidenceDeletionScope,
    tx?: Prisma.TransactionClient,
  ): Promise<void>;
}
