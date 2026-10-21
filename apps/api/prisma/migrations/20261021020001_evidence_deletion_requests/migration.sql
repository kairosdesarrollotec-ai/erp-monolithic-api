-- DEC-EVID-DELETE-002 / Respuestas 2026-10-20 #35 / SDD-KAIROS-TRANSVERSAL 15.5: doble aprobacion para eliminar evidencia.
-- Escrita A MANO (nunca `migrate dev`), ADITIVA: 1 tabla nueva, sin tocar rental_evidence / return_evidence.
-- Indices <= 63 caracteres. Sin FK a proposito (la solicitud es historial; el registro de evidencia desaparece al ejecutarse).
--
-- ROLLBACK: ver rollback.sql (DROP TABLE "evidence_deletion_requests"; solo pierde el historial de solicitudes).

-- CreateTable
CREATE TABLE "evidence_deletion_requests" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "operating_company_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "target_kind" TEXT NOT NULL,
    "parent_id" TEXT NOT NULL,
    "evidence_id" TEXT NOT NULL,
    "evidence_snapshot" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requested_by" TEXT NOT NULL,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "first_approved_by" TEXT,
    "first_approved_at" TIMESTAMP(3),
    "first_approval_note" TEXT,
    "second_approved_by" TEXT,
    "second_approved_at" TIMESTAMP(3),
    "second_approval_note" TEXT,
    "rejected_by" TEXT,
    "rejected_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "executed_at" TIMESTAMP(3),
    "expired_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_deletion_requests_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "evidence_deletion_target_kind_check" CHECK ("target_kind" IN ('RENTAL', 'RETURN')),
    CONSTRAINT "evidence_deletion_status_check" CHECK ("status" IN ('PENDING', 'APPROVED_1', 'EXECUTED', 'REJECTED', 'EXPIRED')),
    CONSTRAINT "evidence_deletion_reason_check" CHECK (char_length(btrim("reason")) >= 5),
    -- Separacion de funciones impuesta en la base: el solicitante no aprueba; el segundo aprobador es distinto del solicitante y del primero.
    CONSTRAINT "evidence_deletion_first_not_requester_check" CHECK ("first_approved_by" IS NULL OR "first_approved_by" <> "requested_by"),
    CONSTRAINT "evidence_deletion_second_distinct_check" CHECK (
      "second_approved_by" IS NULL
      OR ("second_approved_by" <> "requested_by" AND "first_approved_by" IS NOT NULL AND "second_approved_by" <> "first_approved_by")
    ),
    CONSTRAINT "evidence_deletion_rejector_not_requester_check" CHECK ("rejected_by" IS NULL OR "rejected_by" <> "requested_by"),
    -- Coherencia de estados.
    CONSTRAINT "evidence_deletion_approved_1_check" CHECK ("status" <> 'APPROVED_1' OR "first_approved_by" IS NOT NULL),
    CONSTRAINT "evidence_deletion_executed_check" CHECK (
      "status" <> 'EXECUTED'
      OR ("first_approved_by" IS NOT NULL AND "second_approved_by" IS NOT NULL AND "executed_at" IS NOT NULL)
    ),
    CONSTRAINT "evidence_deletion_rejected_check" CHECK (
      "status" <> 'REJECTED' OR ("rejected_by" IS NOT NULL AND "rejection_reason" IS NOT NULL AND "rejected_at" IS NOT NULL)
    )
);

-- CreateIndex
CREATE INDEX "idx_evidence_deletion_scope_status" ON "evidence_deletion_requests"("organization_id", "operating_company_id", "status", "requested_at" DESC);

-- CreateIndex
CREATE INDEX "idx_evidence_deletion_target" ON "evidence_deletion_requests"("target_kind", "evidence_id");

-- CreateIndex
CREATE INDEX "idx_evidence_deletion_expiry" ON "evidence_deletion_requests"("status", "expires_at");

-- Una sola solicitud ABIERTA por evidencia (reintentos y doble clic no abren dos).
CREATE UNIQUE INDEX "uq_evidence_deletion_open_evidence" ON "evidence_deletion_requests"("target_kind", "evidence_id") WHERE "status" IN ('PENDING', 'APPROVED_1');
