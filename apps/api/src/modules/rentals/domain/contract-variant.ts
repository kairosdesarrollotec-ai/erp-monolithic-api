/**
 * BR-DOC-003 (Fiorella, 24-ago-2026): los contratos siguen UNA sola plantilla
 * por combinacion persona natural/juridica x con/sin conductor; solo varian
 * placa, precio y garantia. BR-DOC-002: una sola version vigente por tipo.
 *
 * `withDriver` = el vehiculo lo maneja un conductor distinto del titular
 * (conductor de la empresa, o conductor propio autorizado de una persona
 * juridica, BR-ALQ-015).
 */
export const HOLDER_TYPES = ['NATURAL', 'LEGAL'] as const;
export type HolderType = (typeof HOLDER_TYPES)[number];

export interface ContractVariant {
  holderType: HolderType;
  withDriver: boolean;
}

/** Tipo de plantilla (columna `templates.type`, varchar(50)) por combinacion. */
export const CONTRACT_TEMPLATE_TYPE_BY_VARIANT: Readonly<Record<string, string>> = {
  'NATURAL:false': 'RENTAL_CONTRACT_NATURAL',
  'NATURAL:true': 'RENTAL_CONTRACT_NATURAL_DRIVER',
  'LEGAL:false': 'RENTAL_CONTRACT_LEGAL',
  'LEGAL:true': 'RENTAL_CONTRACT_LEGAL_DRIVER',
};

/** Plantilla generica anterior a la seleccion por combinacion (compatibilidad). */
export const GENERIC_CONTRACT_TEMPLATE_TYPE = 'RENTAL_CONTRACT';

export function contractTemplateTypeFor(variant: ContractVariant): string {
  return CONTRACT_TEMPLATE_TYPE_BY_VARIANT[`${variant.holderType}:${variant.withDriver}`];
}

export function contractVariantCode(variant: ContractVariant): string {
  return `${variant.holderType}_${variant.withDriver ? 'WITH_DRIVER' : 'NO_DRIVER'}`;
}

export const CONTRACT_VARIANT_LABELS: Readonly<Record<string, string>> = {
  'NATURAL:false': 'persona natural, sin conductor',
  'NATURAL:true': 'persona natural, con conductor',
  'LEGAL:false': 'persona juridica, sin conductor',
  'LEGAL:true': 'persona juridica, con conductor',
};

export function contractVariantLabel(variant: ContractVariant): string {
  return CONTRACT_VARIANT_LABELS[`${variant.holderType}:${variant.withDriver}`];
}
