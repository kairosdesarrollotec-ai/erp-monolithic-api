/**
 * TDD-KAIROS-MVP-002-TPL §4.2 — Tipos de plantilla de documento.
 * El campo `type` es varchar(50) — extensible sin migración.
 */
export const TEMPLATE_TYPES = [
  'RENTAL_CONTRACT',
  // BR-DOC-003: una plantilla por combinacion persona natural/juridica x con/sin conductor.
  'RENTAL_CONTRACT_NATURAL',
  'RENTAL_CONTRACT_NATURAL_DRIVER',
  'RENTAL_CONTRACT_LEGAL',
  'RENTAL_CONTRACT_LEGAL_DRIVER',
  'RESERVATION_CONTRACT',
  'RETURN_RESPONSIBILITY',
] as const;

export type TemplateType = (typeof TEMPLATE_TYPES)[number];

export const TemplateType = {
  RENTAL_CONTRACT: 'RENTAL_CONTRACT' as const,
  RENTAL_CONTRACT_NATURAL: 'RENTAL_CONTRACT_NATURAL' as const,
  RENTAL_CONTRACT_NATURAL_DRIVER: 'RENTAL_CONTRACT_NATURAL_DRIVER' as const,
  RENTAL_CONTRACT_LEGAL: 'RENTAL_CONTRACT_LEGAL' as const,
  RENTAL_CONTRACT_LEGAL_DRIVER: 'RENTAL_CONTRACT_LEGAL_DRIVER' as const,
  RESERVATION_CONTRACT: 'RESERVATION_CONTRACT' as const,
  RETURN_RESPONSIBILITY: 'RETURN_RESPONSIBILITY' as const,
} satisfies Record<TemplateType, TemplateType>;
