/** BDD-CON-001.md DAT-CON-002 - obligatoria, siempre. */
export type InquiryNationality = 'PERUANO' | 'EXTRANJERO';

export const INQUIRY_NATIONALITIES: readonly InquiryNationality[] = ['PERUANO', 'EXTRANJERO'];

/**
 * BR-CON-004 (CONFIRMADO): la nacionalidad determina el TERCER requisito
 * documental - peruano -> recibo de agua/luz; extranjero -> constancia de
 * hospedaje (SC-CON-001.02/.03). Se DERIVA de la nacionalidad persistida,
 * nunca se captura por separado (no puede contradecirla).
 *
 * TDD-CON-001.md 23.1 caso obligatorio "cliente extranjero recibiendo el
 * set de requisitos correcto".
 */
export type ThirdRequiredDocument = 'RECIBO_AGUA_O_LUZ' | 'CONSTANCIA_HOSPEDAJE';

export function thirdRequiredDocument(nationality: InquiryNationality): ThirdRequiredDocument {
  return nationality === 'PERUANO' ? 'RECIBO_AGUA_O_LUZ' : 'CONSTANCIA_HOSPEDAJE';
}

/** Documentos que Consulta informa al cliente (BR-CON-004; BDD-ALQ-001 ALQ-P01). */
export type RequiredDocumentCode =
  | 'DNI'
  | 'PASAPORTE_O_CE'
  | 'LICENCIA_CONDUCIR'
  | ThirdRequiredDocument;

export interface RequiredDocument {
  code: RequiredDocumentCode;
  label: string;
}

const REQUIRED_DOCUMENT_LABELS: Record<RequiredDocumentCode, string> = {
  DNI: 'DNI',
  PASAPORTE_O_CE: 'Pasaporte o carné de extranjería',
  LICENCIA_CONDUCIR: 'Licencia de conducir',
  RECIBO_AGUA_O_LUZ: 'Recibo de agua o luz',
  CONSTANCIA_HOSPEDAJE: 'Constancia de hospedaje',
};

/**
 * CON-P06 / OP-CON-003 (hallazgo CON P-03) - documentos que Consulta INFORMA al
 * cliente segun su nacionalidad (solo informativo: Consulta no recibe
 * documentos, Ficha AS-IS). Hoy solo se deriva el TERCER requisito
 * (BR-CON-004); sin nacionalidad conocida (clientes antiguos) la lista es vacia.
 */
export function requiredDocumentsFor(nationality: InquiryNationality | null): RequiredDocument[] {
  if (!nationality) return [];
  // 29-oct: se informan TODOS los documentos del tipo de cliente (no solo el tercero).
  const identity: RequiredDocumentCode = nationality === 'PERUANO' ? 'DNI' : 'PASAPORTE_O_CE';
  const codes: RequiredDocumentCode[] = [identity, 'LICENCIA_CONDUCIR', thirdRequiredDocument(nationality)];
  return codes.map((code) => ({ code, label: REQUIRED_DOCUMENT_LABELS[code] }));
}
