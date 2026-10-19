import { ReturnStatus } from './return-status';

/**
 * BR-DEV-009 / TDD-DEV-001 seccion 9.5 y 24: el expediente de devolución exige el mismo checklist
 * audiovisual que la entrega (35 fotos + 3 videos) antes de completar la inspección.
 */
export const REQUIRED_RETURN_PHOTOS = 35;
export const REQUIRED_RETURN_VIDEOS = 3;

/** Límites del contrato returns.yaml (RequestReturnEvidenceUploadSessionRequest.contentLength). */
export const MAX_RETURN_EVIDENCE_BYTES = 52_428_800;
export const MAX_RETURN_PHOTO_BYTES = 12 * 1024 * 1024;

/** Zona fija de la foto de la prueba de alcolímetro desfavorable (evidencia PHOTO de la devolución). */
export const RETURN_ALCOHOL_TEST_EVIDENCE_ZONE = 'ALCOHOL_TEST';

/** Estados en los que el vehículo está en custodia y se puede adjuntar evidencia del checklist/daños. */
export const RETURN_EVIDENCE_ALLOWED_STATUSES: ReadonlySet<ReturnStatus> = new Set<ReturnStatus>([
  'RECEPCION_PROVISIONAL',
  'INSPECCION',
  'CON_DANOS',
]);

export function missingReturnEvidence(counts: { photos: number; videos: number }): string[] {
  const missing: string[] = [];
  if (counts.photos < REQUIRED_RETURN_PHOTOS) {
    missing.push(`${REQUIRED_RETURN_PHOTOS - counts.photos} fotos restantes (mínimo ${REQUIRED_RETURN_PHOTOS})`);
  }
  if (counts.videos < REQUIRED_RETURN_VIDEOS) {
    missing.push(`${REQUIRED_RETURN_VIDEOS - counts.videos} videos restantes (mínimo ${REQUIRED_RETURN_VIDEOS})`);
  }
  return missing;
}
