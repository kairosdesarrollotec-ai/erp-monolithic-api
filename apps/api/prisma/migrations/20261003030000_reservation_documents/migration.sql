-- Bug-03: Payment voucher and other documents attached to a reservation.
CREATE TABLE "reservation_documents" (
  "id"              TEXT          NOT NULL,
  "reservation_id"  TEXT          NOT NULL,
  "document_type"   VARCHAR(40)   NOT NULL,
  "object_url"      TEXT          NOT NULL,
  "created_at"      TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "reservation_documents_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "reservation_documents_reservation_id_fkey"
    FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "reservation_documents_reservation_id_idx" ON "reservation_documents"("reservation_id");
