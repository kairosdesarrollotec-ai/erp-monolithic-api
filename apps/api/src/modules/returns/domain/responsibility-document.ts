import { MissingResponsibilityDocumentError } from './return-errors';

/**
 * BR-DEV-009 / DAT-DEV-005 / EX-DEV-001 - Documento de responsabilidad firmado por quien entrega el vehículo.
 * Los datos del tercero (si quien devuelve no es el titular) viven en la propia firma/relación; no se crean
 * entidades nuevas. PROVISIONAL: la validez jurídica de la firma digital queda pendiente de Legal (mismo
 * criterio que PROP-012 de Alquiler).
 */
export interface ResponsibilityDocumentInput {
  signerName?: string;
  signerIsHolder?: boolean;
  signerRelationToHolder?: string;
  signatureData?: string;
}

export interface ResolvedResponsibilityDocument {
  signerName: string;
  signerIsHolder: boolean;
  signerRelationToHolder: string | null;
  signatureData: string;
}

function clean(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** Valida y normaliza; cualquier faltante -> MissingResponsibilityDocumentError (422). */
export function resolveResponsibilityDocument(
  input: ResponsibilityDocumentInput | undefined | null,
): ResolvedResponsibilityDocument {
  if (!input) {
    throw new MissingResponsibilityDocumentError();
  }
  const signerName = clean(input.signerName);
  const signatureData = clean(input.signatureData);
  if (!signerName || !signatureData || typeof input.signerIsHolder !== 'boolean') {
    throw new MissingResponsibilityDocumentError(
      'El documento de responsabilidad debe incluir nombre del firmante, indicar si es el titular y la firma (DAT-DEV-005).',
    );
  }
  const relation = clean(input.signerRelationToHolder);
  if (!input.signerIsHolder && !relation) {
    throw new MissingResponsibilityDocumentError(
      'Si quien devuelve no es el titular, el documento de responsabilidad debe indicar su relación con el titular (EX-DEV-001).',
    );
  }
  return {
    signerName,
    signerIsHolder: input.signerIsHolder,
    signerRelationToHolder: input.signerIsHolder ? null : relation,
    signatureData,
  };
}
