-- Bug-03: Payment voucher and other documents attached to a reservation.
CREATE TABLE "reservation_documents" (
  "id"              UUID          NOT NULL DEFAULT gen_random_uuid(),
  "reservation_id"  UUID          NOT NULL,
  "document_type"   VARCHAR(40)   NOT NULL,
  "object_url"      TEXT          NOT NULL,
  "created_at"      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT "reservation_documents_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "reservation_documents_reservation_id_fkey"
    FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE CASCADE
);

CREATE INDEX "reservation_documents_reservation_id_idx" ON "reservation_documents"("reservation_id");
