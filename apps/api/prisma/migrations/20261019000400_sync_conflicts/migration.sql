-- TR-08 / SDD-KAIROS-TRANSVERSAL 17.3-17.4 / DEC-SYNC-001..: contrato backend de conflictos de sincronizacion offline
-- (checklist de ENTREGA y de RECEPCION). Escrita A MANO (nunca `migrate dev`), ADITIVA: 2 tablas nuevas, sin tocar
-- tablas existentes. Indices <= 63 caracteres.
--
-- ROLLBACK NOTE: DROP TABLE "sync_conflicts"; DROP TABLE "sync_checklist_states"; (solo contienen datos derivados de
-- la sincronizacion offline; la evidencia real vive en rental_evidence / return_evidence y no se toca).

-- CreateTable
CREATE TABLE "sync_checklist_states" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "operating_company_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "checklist_type" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "rental_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SYNCED',
    "version" INTEGER NOT NULL DEFAULT 1,
    "fields" JSONB NOT NULL DEFAULT '{}',
    "evidence" JSONB NOT NULL DEFAULT '[]',
    "server_confirmed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_checklist_states_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "sync_checklist_states_type_check" CHECK ("checklist_type" IN ('ENTREGA', 'RECEPCION')),
    CONSTRAINT "sync_checklist_states_status_check" CHECK ("status" IN ('SYNCED', 'SYNC_CONFLICT'))
);

-- CreateTable
CREATE TABLE "sync_conflicts" (
    "id" TEXT NOT NULL,
    "state_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "operating_company_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "checklist_type" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "rental_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "server_version" JSONB NOT NULL,
    "local_version" JSONB NOT NULL,
    "local_base_rev" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "reason" TEXT,
    "detected_by" TEXT NOT NULL,
    "device_id" TEXT,
    "resolved_by" TEXT,
    "resolved_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_conflicts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "sync_conflicts_type_check" CHECK ("checklist_type" IN ('ENTREGA', 'RECEPCION')),
    CONSTRAINT "sync_conflicts_kind_check" CHECK ("kind" IN ('FIELD', 'EVIDENCE')),
    CONSTRAINT "sync_conflicts_status_check" CHECK ("status" IN ('OPEN', 'RESOLVED')),
    CONSTRAINT "sync_conflicts_resolution_check" CHECK ("resolution" IS NULL OR "resolution" IN ('KEEP_LOCAL', 'KEEP_SERVER', 'MERGE')),
    -- Un conflicto resuelto siempre trae accion, motivo y autor (DEC-SYNC: siempre se audita, exige reason).
    CONSTRAINT "sync_conflicts_resolved_complete_check" CHECK (
      "status" = 'OPEN'
      OR ("resolution" IS NOT NULL AND "reason" IS NOT NULL AND "resolved_by" IS NOT NULL AND "resolved_at" IS NOT NULL)
    )
);

-- CreateIndex
CREATE UNIQUE INDEX "sync_checklist_states_type_source_key" ON "sync_checklist_states"("checklist_type", "source_id");

-- CreateIndex
CREATE INDEX "idx_sync_states_scope_status" ON "sync_checklist_states"("organization_id", "operating_company_id", "status");

-- CreateIndex
CREATE INDEX "idx_sync_conflicts_state_status" ON "sync_conflicts"("state_id", "status");

-- CreateIndex
CREATE INDEX "idx_sync_conflicts_scope_source" ON "sync_conflicts"("organization_id", "operating_company_id", "checklist_type", "source_id", "status");

-- Un solo conflicto ABIERTO por dato (reintentos idempotentes del dispositivo).
CREATE UNIQUE INDEX "uq_sync_conflicts_open_key" ON "sync_conflicts"("state_id", "kind", "key") WHERE "status" = 'OPEN';

-- AddForeignKey
ALTER TABLE "sync_conflicts" ADD CONSTRAINT "sync_conflicts_state_id_fkey" FOREIGN KEY ("state_id") REFERENCES "sync_checklist_states"("id") ON DELETE CASCADE ON UPDATE CASCADE;
