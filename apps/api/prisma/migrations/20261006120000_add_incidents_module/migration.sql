-- ============================================================
-- ROLLBACK (documentacion — no ejecutar automaticamente)
-- ============================================================
-- Para revertir esta migracion, ejecutar en orden:
--
--   -- 1. Eliminar foreign keys de incident_actions
--   ALTER TABLE "incident_actions" DROP CONSTRAINT IF EXISTS "incident_actions_incident_id_fkey";
--
--   -- 2. Eliminar foreign keys de incidents
--   ALTER TABLE "incidents" DROP CONSTRAINT IF EXISTS "incidents_return_id_operating_company_id_fkey";
--   ALTER TABLE "incidents" DROP CONSTRAINT IF EXISTS "incidents_rental_id_operating_company_id_fkey";
--   ALTER TABLE "incidents" DROP CONSTRAINT IF EXISTS "incidents_branch_id_operating_company_id_fkey";
--   ALTER TABLE "incidents" DROP CONSTRAINT IF EXISTS "incidents_operating_company_id_organization_id_fkey";
--
--   -- 3. Eliminar indices
--   DROP INDEX IF EXISTS "incident_actions_incident_id_created_at_idx";
--   DROP INDEX IF EXISTS "incidents_return_id_idx";
--   DROP INDEX IF EXISTS "incidents_rental_id_status_idx";
--   DROP INDEX IF EXISTS "incidents_scope_status_created_idx";
--
--   -- 4. Eliminar tablas
--   DROP TABLE IF EXISTS "incident_actions";
--   DROP TABLE IF EXISTS "incidents";
--
--   -- 5. Eliminar enums
--   DROP TYPE IF EXISTS "IncidentActionKind";
--   DROP TYPE IF EXISTS "IncidentStatus";
--   DROP TYPE IF EXISTS "IncidentSeverity";
--   DROP TYPE IF EXISTS "IncidentType";
--
-- ADVERTENCIA: Esta operacion elimina datos irreversiblemente.
-- Requiere autorizacion explicita antes de ejecutar en cualquier entorno
-- con datos (staging o produccion). Ver CLAUDE.md §7 y §15.
-- ============================================================

-- CreateEnum
CREATE TYPE "IncidentType" AS ENUM ('KEY_LOSS', 'CRASH_OR_DAMAGE', 'TRAFFIC_FINE_OR_INTERVENTION', 'TOWING', 'OTHER');

-- CreateEnum
CREATE TYPE "IncidentSeverity" AS ENUM ('LEVE', 'MODERADA', 'GRAVE');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('ABIERTA', 'CERRADA', 'VIA_LEGAL');

-- CreateEnum
CREATE TYPE "IncidentActionKind" AS ENUM ('REPORTED', 'ACTION', 'RESOLVED', 'CLOSED', 'REFERRED_LEGAL');

-- CreateTable
CREATE TABLE "incidents" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "operating_company_id" TEXT NOT NULL,
  "branch_id" TEXT NOT NULL,
  "rental_id" TEXT NOT NULL,
  "return_id" TEXT,
  "type" "IncidentType" NOT NULL,
  "severity" "IncidentSeverity" NOT NULL,
  "status" "IncidentStatus" NOT NULL DEFAULT 'ABIERTA',
  "description" TEXT NOT NULL,
  "suggestion" TEXT,
  "reported_at" TIMESTAMP(3) NOT NULL,
  "responsible_user_id" TEXT NOT NULL,
  "resolution_summary" TEXT,
  "resolved_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by" TEXT NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_by" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT "incidents_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "incident_description_not_blank" CHECK (char_length(btrim("description")) > 0),
  CONSTRAINT "incident_closed_has_resolution" CHECK (
    "status" <> 'CERRADA' OR ("resolution_summary" IS NOT NULL AND "resolved_at" IS NOT NULL)
  )
);

-- CreateTable
CREATE TABLE "incident_actions" (
  "id" TEXT NOT NULL,
  "incident_id" TEXT NOT NULL,
  "kind" "IncidentActionKind" NOT NULL,
  "description" TEXT NOT NULL,
  "author_user_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "incident_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "incidents_scope_status_created_idx" ON "incidents"("organization_id", "operating_company_id", "branch_id", "status", "created_at" DESC);
CREATE INDEX "incidents_rental_id_status_idx" ON "incidents"("rental_id", "status");
CREATE INDEX "incidents_return_id_idx" ON "incidents"("return_id");

-- CreateIndex
CREATE INDEX "incident_actions_incident_id_created_at_idx" ON "incident_actions"("incident_id", "created_at");

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_operating_company_id_organization_id_fkey" FOREIGN KEY ("operating_company_id", "organization_id") REFERENCES "companies"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_branch_id_operating_company_id_fkey" FOREIGN KEY ("branch_id", "operating_company_id") REFERENCES "branches"("id", "company_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_rental_id_operating_company_id_fkey" FOREIGN KEY ("rental_id", "operating_company_id") REFERENCES "rentals"("id", "operating_company_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_return_id_operating_company_id_fkey" FOREIGN KEY ("return_id", "operating_company_id") REFERENCES "returns"("id", "operating_company_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_actions" ADD CONSTRAINT "incident_actions_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
