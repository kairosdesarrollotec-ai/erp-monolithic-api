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
