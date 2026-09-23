/**
 * Hallazgo CRITICO de revalidacion PR#7 (migracion segura): `LEGACY_STUB`
 * marca los stubs minimos que PR#6 creaba solo para respaldar la FK de
 * Reserva (backfilleados por la migracion
 * 20260923000000_inquiries_expand_backfill_contract sin inventar los datos
 * de CON-02 que nunca se capturaron). Toda consulta registrada por este
 * modulo es `CON02` y persiste el snapshot completo.
 */
export type InquiryDataOrigin = 'CON02' | 'LEGACY_STUB';
