-- TR-06 (SDD-KAIROS-TRANSVERSAL.md 18.2, HU-24) - proyeccion de lectura
-- del Tablero por rol, alimentada por outbox_events. Ver el modelo
-- DashboardItem en schema.prisma para el detalle completo del diseno y
-- claude/Diseno_Agregador_Transversal_TR-06-07-08.md (Project KAIROS)
-- para el diseno de agregador completo (TR-06/TR-07/TR-08).
--
-- Generada y revisada a mano, mismo criterio y misma limitacion de red
-- que 20260921190000_add_reservations (sin salida hacia
-- binaries.prisma.sh en este entorno sandbox, ver docs/decision-log.md
-- PROP-003/NOTA-PROP-003): correr en un entorno con red completa antes
-- de mergear:
--   npx prisma generate
--   npx prisma migrate dev
-- para que Prisma re-valide/re-genere esta migracion oficialmente.

-- CreateTable
CREATE TABLE "dashboard_items" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "operating_company_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "role" "WorkerRole" NOT NULL,
    "item_type" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "deep_link" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "source_event_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),
    "dismissed_at" TIMESTAMP(3),

    CONSTRAINT "dashboard_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- Idempotencia del proyector (NFR-KAI-004): reprocesar el mismo evento de
-- outbox_events no duplica el item de tablero que ya genero.
CREATE UNIQUE INDEX "dashboard_items_source_event_id_item_type_key" ON "dashboard_items"("source_event_id", "item_type");

-- CreateIndex
CREATE INDEX "dashboard_items_organization_id_operating_company_id_branc_idx" ON "dashboard_items"("organization_id", "operating_company_id", "branch_id", "role", "dismissed_at", "priority");
