-- HR-ASIST (Respuestas #9): la marca propia guarda la foto con evidence_kind = 'SELF_PHOTO'; el CHECK original solo
-- admitía 'WHATSAPP_PHOTO' y la entrada del propio colaborador fallaba con 500 (23514).
ALTER TABLE "attendance_records" DROP CONSTRAINT IF EXISTS "attendance_records_evidence_chk";
ALTER TABLE "attendance_records"
    ADD CONSTRAINT "attendance_records_evidence_chk" CHECK (
        "evidence_kind" IS NULL
        OR ("evidence_kind" IN ('WHATSAPP_PHOTO', 'SELF_PHOTO')
            AND ("evidence_storage_ref" IS NOT NULL OR "evidence_url" IS NOT NULL)
            AND "evidence_captured_at" IS NOT NULL)
    );
