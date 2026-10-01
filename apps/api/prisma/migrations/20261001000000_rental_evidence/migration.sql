-- ALQ-09 / BR-INS-003 / BR-INS-004: evidencia real (foto/video) del checklist
-- de entrega de un alquiler, en reemplazo gradual de los contadores
-- photosCount/videosCount (ver complete-delivery.handler.ts).

CREATE TYPE "RentalEvidenceType" AS ENUM ('PHOTO', 'VIDEO');

CREATE TABLE "rental_evidence" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "operating_company_id" TEXT NOT NULL,
    "rental_id" TEXT NOT NULL,
    "type" "RentalEvidenceType" NOT NULL,
    "zone" TEXT NOT NULL,
    "object_url" TEXT NOT NULL,
    "uploaded_by" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rental_evidence_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "rental_evidence_rental_id_type_idx" ON "rental_evidence"("rental_id", "type");

CREATE INDEX "rental_evidence_organization_id_operating_company_id_renta_idx" ON "rental_evidence"("organization_id", "operating_company_id", "rental_id");

ALTER TABLE "rental_evidence" ADD CONSTRAINT "rental_evidence_rental_id_operating_company_id_fkey" FOREIGN KEY ("rental_id", "operating_company_id") REFERENCES "rentals"("id", "operating_company_id") ON DELETE RESTRICT ON UPDATE CASCADE;
