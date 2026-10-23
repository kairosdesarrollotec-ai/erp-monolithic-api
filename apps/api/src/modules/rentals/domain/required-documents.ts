/**
 * BR-CON-004 (CONFIRMADO; Russbel 22-oct-2026): documentos requeridos para validar un alquiler segun la nacionalidad
 * del cliente.
 *
 * - PERUANO:    DNI + licencia de conducir + recibo de agua o luz.
 * - EXTRANJERO: pasaporte + carne de extranjeria (CE) + licencia de conducir + constancia de hospedaje +
 *               fecha de ingreso al pais (dato del cliente, no un archivo).
 *
 * Decision del backend (resuelve la inconsistencia "comprobante de domicilio opcional en UI pero 422 en back"): el tercer
 * documento (recibo / constancia de hospedaje) es OBLIGATORIO. El front debe marcarlo como requerido; `requiredDocuments`
 * en la respuesta de Alquiler (y en la Consulta) es la fuente de verdad.
 */
export type RequiredDocumentCode =
  | 'DNI'
  | 'PASAPORTE'
  | 'CARNE_EXTRANJERIA'
  | 'LICENCIA_CONDUCIR'
  | 'RECIBO_AGUA_LUZ'
  | 'CONSTANCIA_HOSPEDAJE'
  | 'FECHA_INGRESO';

export type RequiredDocumentKind = 'DOCUMENT' | 'DATA';

export interface RequiredDocument {
  code: RequiredDocumentCode;
  label: string;
  /** DOCUMENT = el personal valida el documento (casilla); DATA = dato del cliente que debe existir. */
  kind: RequiredDocumentKind;
  /** Campo de `documentDetails` (validate-documents) con el que se confirma. null para DATA. */
  field: 'identityDocumentValid' | 'passportValid' | 'foreignerCardValid' | 'driverLicenseValid' | 'addressOrStayProofValid' | null;
}

export type CustomerNationality = 'PERUANO' | 'EXTRANJERO';

const PERUVIAN: readonly RequiredDocument[] = [
  { code: 'DNI', label: 'DNI', kind: 'DOCUMENT', field: 'identityDocumentValid' },
  { code: 'LICENCIA_CONDUCIR', label: 'Licencia de conducir vigente', kind: 'DOCUMENT', field: 'driverLicenseValid' },
  { code: 'RECIBO_AGUA_LUZ', label: 'Recibo de agua o luz', kind: 'DOCUMENT', field: 'addressOrStayProofValid' },
];

const FOREIGN: readonly RequiredDocument[] = [
  { code: 'PASAPORTE', label: 'Pasaporte', kind: 'DOCUMENT', field: 'passportValid' },
  { code: 'CARNE_EXTRANJERIA', label: 'Carné de extranjería (CE)', kind: 'DOCUMENT', field: 'foreignerCardValid' },
  { code: 'LICENCIA_CONDUCIR', label: 'Licencia de conducir vigente', kind: 'DOCUMENT', field: 'driverLicenseValid' },
  { code: 'CONSTANCIA_HOSPEDAJE', label: 'Constancia de hospedaje', kind: 'DOCUMENT', field: 'addressOrStayProofValid' },
  { code: 'FECHA_INGRESO', label: 'Fecha de ingreso al país', kind: 'DATA', field: null },
];

/**
 * Nacionalidad efectiva: la persistida en el cliente; si es un cliente antiguo sin dato se deduce del tipo de documento
 * (DNI/RUC -> peruano; cualquier otro -> extranjero).
 */
export function resolveNationality(
  nationality: CustomerNationality | null | undefined,
  documentType: string | null | undefined,
): CustomerNationality {
  if (nationality) return nationality;
  const type = (documentType ?? '').toUpperCase();
  return type === 'DNI' || type === 'RUC' || type === '' ? 'PERUANO' : 'EXTRANJERO';
}

export function requiredDocumentsFor(nationality: CustomerNationality): readonly RequiredDocument[] {
  return nationality === 'PERUANO' ? PERUVIAN : FOREIGN;
}

export interface DocumentDetailsInput {
  identityDocumentValid?: boolean;
  passportValid?: boolean;
  foreignerCardValid?: boolean;
  driverLicenseValid?: boolean;
  addressOrStayProofValid?: boolean;
}

/** Documentos requeridos que NO estan validados / disponibles. Vacio = completo. */
export function missingRequiredDocuments(
  nationality: CustomerNationality,
  details: DocumentDetailsInput,
  customer: { countryEntryDate?: Date | null },
): RequiredDocument[] {
  return requiredDocumentsFor(nationality).filter((doc) => {
    if (doc.kind === 'DATA') return !customer.countryEntryDate;
    return details[doc.field as keyof DocumentDetailsInput] !== true;
  });
}
