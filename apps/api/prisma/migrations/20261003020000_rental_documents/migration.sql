-- Bug-04: Customer documents uploaded during rental Stage 1 (licencia, DNI, etc.).
-- Follows the same GCS-signed-URL pattern as RentalEvidence.
CREATE TABLE "rental_documents" (
  "id"            TEXT          NOT NULL,
  "rental_id"     TEXT          NOT NULL,
  "document_type" VARCHAR(40)   NOT NULL,
  "object_url"    TEXT          NOT NULL,
  "created_at"    TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "rental_documents_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "rental_documents_rental_id_fkey"
    FOREIGN KEY ("rental_id") REFERENCES "rentals"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "rental_documents_rental_id_idx" ON "rental_documents"("rental_id");
