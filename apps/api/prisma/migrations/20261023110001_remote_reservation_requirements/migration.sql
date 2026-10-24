-- DAT-RES-001 / BR-RES-005 / BR-RES-006 / SC-RES-003 / SC-RES-004 (23-oct-2026)
-- Indice compuesto para consulta rapida de documentos por tipo en una reserva (p.ej. VIDEO_360, SIGNED_ACCEPTANCE, PAYMENT_VOUCHER).

CREATE INDEX IF NOT EXISTS "reservation_documents_reservation_id_document_type_idx"
  ON "reservation_documents"("reservation_id", "document_type");
