/**
 * Hallazgo MEDIO de revalidacion PR#7 ("el limite runtime no replica el
 * maximo OpenAPI"): unica fuente de verdad del tamano de pagina de la
 * bandeja CON-01. `packages/contracts/openapi/inquiries.yaml` declara los
 * mismos valores; `inquiries-openapi.contract.spec.ts` falla si divergen.
 */
export const INQUIRY_LIST_DEFAULT_LIMIT = 20;
export const INQUIRY_LIST_MAX_LIMIT = 100;
