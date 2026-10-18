import { ContractVariantDriverConflictError } from './rental-errors';

/**
 * BR-DOC-003 (Fiorella, 24-ago-2026): los contratos siguen UNA sola plantilla
 * por combinacion persona natural/juridica x con/sin conductor; solo varian
 * placa, precio y garantia. BR-DOC-002: una sola version vigente por tipo.
 *
 * `withCompanyDriver` (antes `withDriver`, DEC-ALQ-DRIVER-001) = el cliente
 * pide que la EMPRESA le OFREZCA un conductor (servicio de conductor).
 * NO es lo mismo que BR-ALQ-015: "conductor distinto del titular" = otra
 * persona que maneja un alquiler ya hecho sin haberlo aprobado antes (rol
 * DRIVER de rental_parties); esa situacion NO elige plantilla de contrato.
 */
export const HOLDER_TYPES = ['NATURAL', 'LEGAL'] as const;
export type HolderType = (typeof HOLDER_TYPES)[number];

export interface ContractVariant {
  holderType: HolderType;
  withCompanyDriver: boolean;
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

/**
 * DEC-ALQ-DRIVER-001: `withDriver` queda como alias DEPRECADO de
 * `withCompanyDriver` en la entrada HTTP. Si llegan ambos y difieren es un
 * error de cliente (400 CONTRACT_VARIANT_DRIVER_CONFLICT).
 */
export function resolveWithCompanyDriver(input: {
  withCompanyDriver?: boolean | null;
  withDriver?: boolean | null;
}): boolean | undefined {
  const a = input.withCompanyDriver ?? undefined;
  const b = input.withDriver ?? undefined;
  if (a !== undefined && b !== undefined && a !== b) {
    throw new ContractVariantDriverConflictError();
  }
  return a ?? b;
}

export function contractTemplateTypeFor(variant: ContractVariant): string {
  return CONTRACT_TEMPLATE_TYPE_BY_VARIANT[`${variant.holderType}:${variant.withCompanyDriver}`];
}

export function contractVariantCode(variant: ContractVariant): string {
  return `${variant.holderType}_${variant.withCompanyDriver ? 'WITH_DRIVER' : 'NO_DRIVER'}`;
}

export const CONTRACT_VARIANT_LABELS: Readonly<Record<string, string>> = {
  'NATURAL:false': 'persona natural, sin conductor de la empresa',
  'NATURAL:true': 'persona natural, con conductor de la empresa',
  'LEGAL:false': 'persona juridica, sin conductor de la empresa',
  'LEGAL:true': 'persona juridica, con conductor de la empresa',
};

export function contractVariantLabel(variant: ContractVariant): string {
  return CONTRACT_VARIANT_LABELS[`${variant.holderType}:${variant.withCompanyDriver}`];
}

/** Tipo de titular codificado en `contract_variant` (`NATURAL_*` / `LEGAL_*`); null si no hay contrato con variante. */
export function holderTypeFromContractVariant(code: string | null | undefined): HolderType | null {
  if (!code) return null;
  if (code.startsWith('NATURAL_')) return 'NATURAL';
  if (code.startsWith('LEGAL_')) return 'LEGAL';
  return null;
}

/** DEC-ALQ-COMPANY-DRIVER-004: la variante codificada corresponde a "con conductor de la empresa". */
export function isCompanyDriverVariantCode(code: string | null | undefined): boolean {
  return !!code && code.endsWith('_WITH_DRIVER');
}
