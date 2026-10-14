-- DEC-ADP-ATT-EVIDENCE-001 - Evidencia fotografica de asistencia (foto con reloj+hora+rostro enviada al grupo
-- de WhatsApp). Escrita A MANO (migrate deploy), sin CONCURRENTLY. Todas las columnas son NULLABLE: los registros
-- previos quedan sin evidencia (el API los expone con evidenceMissing = true).

-- AlterTable
ALTER TABLE "attendance_records"
    ADD COLUMN "evidence_kind" VARCHAR(30),
    ADD COLUMN "evidence_storage_ref" TEXT,
    ADD COLUMN "evidence_url" TEXT,
    ADD COLUMN "evidence_captured_at" TIMESTAMP(3),
    ADD COLUMN "evidence_note" TEXT,
    ADD COLUMN "evidence_corroborated_by_id" TEXT,
    ADD COLUMN "evidence_corroborated_at" TIMESTAMP(3);

-- Coherencia: si hay tipo de evidencia debe haber referencia (storage_ref o url) y la fecha/hora de captura.
ALTER TABLE "attendance_records"
    ADD CONSTRAINT "attendance_records_evidence_chk" CHECK (
        "evidence_kind" IS NULL
        OR ("evidence_kind" = 'WHATSAPP_PHOTO'
            AND ("evidence_storage_ref" IS NOT NULL OR "evidence_url" IS NOT NULL)
            AND "evidence_captured_at" IS NOT NULL)
    );
