-- HU-26 (Consulta) - completa `inquiries` (creada como stub minimo por
-- 20260921190000_add_reservations: id/organization_id/
-- operating_company_id/created_at) y crea `interactions`/`quotations`.
--
-- Reemplaza a 20260921200000_add_inquiries_detail y
-- 20260921201500_fix_inquiries_index_and_customer_fk (nunca mergeadas).
--
-- Hallazgo CRITICO de revalidacion PR#7 (d7a6124, "migracion insegura
-- sobre datos existentes"): la version anterior agregaba columnas
-- NOT NULL sin default ni backfill, y fallaba en cualquier base donde
-- PR#6 ya hubiera guardado consultas stub. Esta version sigue el patron
-- expand -> backfill -> verify -> contract (mismo patron que
-- 20260921180000_add_worker_role de PR#5) y NUNCA inventa datos:
--
--   * Cada stub existente de PR#6 existe solo para respaldar la FK de
--     una Reserva (PROP-005). De esa reserva se derivan de forma
--     verificable: sede (branch_id), responsable (created_by), estado
--     CONVERTIDA (BR-CON-002: ya derivo a Reserva) y uso turistico = true
--     (BDD-CON-001 10.4: solo se deriva si el uso es turistico).
--   * Lo que NUNCA se capturo (canal, nacionalidad, destino, etc.) queda
--     NULL y la fila se marca data_origin = 'LEGACY_STUB'. El CHECK
--     inquiries_con02_snapshot_check exige esos datos solo a las filas
--     'CON02' (toda consulta nueva).
--   * Si un stub no tiene reserva (sin fuente de sede/responsable) o una
--     consulta tiene mas de una reserva (viola la cardinalidad 1:1 nueva),
--     la migracion ABORTA con un mensaje accionable antes de tocar nada -
--     nunca se elige un valor arbitrario.
--
-- Probado con apps/api/test/migrations/inquiries-upgrade.test.sh sobre
-- PostgreSQL con datos poblados (caso feliz + 2 casos de aborto).

-- ============================================================
-- 0) VERIFICACION PREVIA (antes de modificar nada)
-- ============================================================
DO $$
DECLARE
  orphan_stubs integer;
  multi_reservations integer;
BEGIN
  SELECT count(*) INTO orphan_stubs
    FROM "inquiries" i
    WHERE NOT EXISTS (SELECT 1 FROM "reservations" r WHERE r."inquiry_id" = i."id");
  IF orphan_stubs > 0 THEN
    RAISE EXCEPTION 'inquiries_expand_backfill_contract: % consulta(s) stub sin reserva asociada - no hay fuente verificable de sede/responsable para backfillearlas. Revisarlas manualmente (asociar o eliminar) antes de migrar.', orphan_stubs;
  END IF;

  SELECT count(*) INTO multi_reservations
    FROM (SELECT "inquiry_id" FROM "reservations" GROUP BY "inquiry_id" HAVING count(*) > 1) d;
  IF multi_reservations > 0 THEN
    RAISE EXCEPTION 'inquiries_expand_backfill_contract: % consulta(s) con mas de una reserva - viola la cardinalidad 1:1 Consulta->Reserva (TDD-CON-001 7.3/8.1). Resolver los duplicados antes de migrar.', multi_reservations;
  END IF;
END $$;

-- ============================================================
-- 1) EXPAND - tipos y columnas nuevas, todas NULLABLE
-- ============================================================
-- CreateEnum
CREATE TYPE "InquiryChannel" AS ENUM ('WHATSAPP', 'LLAMADA', 'PRESENCIAL', 'WEB', 'REDES');

-- CreateEnum
CREATE TYPE "InquiryStatus" AS ENUM ('REGISTRADA', 'COTIZADA', 'CONVERTIDA', 'CERRADA_SIN_CONVERSION');

-- CreateEnum
CREATE TYPE "InquiryNationality" AS ENUM ('PERUANO', 'EXTRANJERO');

-- CreateEnum
CREATE TYPE "InquiryDataOrigin" AS ENUM ('CON02', 'LEGACY_STUB');

-- AlterTable
ALTER TABLE "inquiries"
    ADD COLUMN "branch_id" TEXT,
    ADD COLUMN "customer_id" TEXT,
    ADD COLUMN "channel" "InquiryChannel",
    ADD COLUMN "tourist_use" BOOLEAN,
    ADD COLUMN "prospect_name" TEXT,
    ADD COLUMN "prospect_document_type" TEXT,
    ADD COLUMN "prospect_document_number" TEXT,
    ADD COLUMN "nationality" "InquiryNationality",
    ADD COLUMN "destination" TEXT,
    ADD COLUMN "estimated_days" INTEGER,
    ADD COLUMN "travel_start_date" DATE,
    ADD COLUMN "party_size" INTEGER,
    ADD COLUMN "country_entry_date" DATE,
    ADD COLUMN "data_origin" "InquiryDataOrigin",
    ADD COLUMN "status" "InquiryStatus",
    ADD COLUMN "closed_reason" TEXT,
    ADD COLUMN "created_by" TEXT,
    ADD COLUMN "version" INTEGER;

-- ============================================================
-- 2) BACKFILL - solo desde fuentes verificables (la reserva asociada)
-- ============================================================
UPDATE "inquiries" i
SET "branch_id"   = r."branch_id",
    "customer_id" = r."customer_id",
    "created_by"  = r."created_by",
    "tourist_use" = true,
    "status"      = 'CONVERTIDA',
    "data_origin" = 'LEGACY_STUB',
    "version"     = 1
FROM "reservations" r
WHERE r."inquiry_id" = i."id";

-- ============================================================
-- 3) VERIFY - ninguna fila puede quedar sin los datos obligatorios
-- ============================================================
DO $$
DECLARE
  incomplete integer;
BEGIN
  SELECT count(*) INTO incomplete FROM "inquiries"
    WHERE "branch_id" IS NULL OR "created_by" IS NULL OR "tourist_use" IS NULL
       OR "status" IS NULL OR "data_origin" IS NULL OR "version" IS NULL;
  IF incomplete > 0 THEN
    RAISE EXCEPTION 'inquiries_expand_backfill_contract: % fila(s) quedaron sin backfill completo - se aborta sin aplicar el contract.', incomplete;
  END IF;
END $$;

-- ============================================================
-- 4) CONTRACT - obligatoriedad y defaults definitivos
-- ============================================================
ALTER TABLE "inquiries"
    ALTER COLUMN "branch_id" SET NOT NULL,
    ALTER COLUMN "tourist_use" SET NOT NULL,
    ALTER COLUMN "created_by" SET NOT NULL,
    ALTER COLUMN "status" SET DEFAULT 'REGISTRADA',
    ALTER COLUMN "status" SET NOT NULL,
    ALTER COLUMN "data_origin" SET DEFAULT 'CON02',
    ALTER COLUMN "data_origin" SET NOT NULL,
    ALTER COLUMN "version" SET DEFAULT 1,
    ALTER COLUMN "version" SET NOT NULL;

-- ============================================================
-- 5) Tablas nuevas
-- ============================================================
-- CreateTable
CREATE TABLE "interactions" (
    "id" TEXT NOT NULL,
    "inquiry_id" TEXT NOT NULL,
    "channel" "InquiryChannel" NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "outcome" TEXT,
    "note" TEXT,

    CONSTRAINT "interactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotations" (
    "id" TEXT NOT NULL,
    "inquiry_id" TEXT NOT NULL,
    "operating_company_id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "rate_card_version_id" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "estimated_days" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "valid_until" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quotations_pkey" PRIMARY KEY ("id")
);

-- ============================================================
-- 6) Indices
-- ============================================================
-- CreateIndex
-- Hallazgo MEDIO "keyset real createdAt/id": respalda scope + orden
-- (created_at DESC, id DESC) de la bandeja paginada.
CREATE INDEX "inquiries_organization_id_operating_company_id_branch_id_cr_idx" ON "inquiries"("organization_id", "operating_company_id", "branch_id", "created_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "inquiries_organization_id_operating_company_id_branch_id_st_idx" ON "inquiries"("organization_id", "operating_company_id", "branch_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "interactions_inquiry_id_idx" ON "interactions"("inquiry_id");

-- CreateIndex
CREATE INDEX "quotations_inquiry_id_created_at_idx" ON "quotations"("inquiry_id", "created_at" DESC);

-- CreateIndex
-- Hallazgo CRITICO "cardinalidad Inquiry -> Reservation no garantizada":
-- una consulta se convierte a lo sumo en UNA reserva, garantizado por la
-- base (la verificacion del paso 0 asegura que los datos existentes ya
-- cumplen esta regla antes de crear el indice).
CREATE UNIQUE INDEX "reservations_inquiry_id_key" ON "reservations"("inquiry_id");

-- ============================================================
-- 7) Claves foraneas
-- ============================================================
-- AddForeignKey
-- La sede siempre pertenece a la misma empresa de la consulta.
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_branch_id_operating_company_id_fkey" FOREIGN KEY ("branch_id", "operating_company_id") REFERENCES "branches"("id", "company_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "inquiries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
-- Hallazgo ALTO "aislamiento de cliente y vehiculo": la cotizacion, su
-- consulta y el vehiculo cotizado pertenecen siempre a la MISMA empresa.
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_inquiry_id_operating_company_id_fkey" FOREIGN KEY ("inquiry_id", "operating_company_id") REFERENCES "inquiries"("id", "operating_company_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_vehicle_id_operating_company_id_fkey" FOREIGN KEY ("vehicle_id", "operating_company_id") REFERENCES "vehicles"("id", "operating_company_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- 8) CHECK constraints (defensa en profundidad; Prisma 5 no los expresa)
-- ============================================================
-- BR-CON-002 / DAT-CON-005: motivo obligatorio al cerrar sin conversion.
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_closed_reason_check" CHECK (
    "status" <> 'CERRADA_SIN_CONVERSION' OR "closed_reason" IS NOT NULL
);

-- Contador optimista (If-Match): arranca en 1 y solo crece.
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_version_check" CHECK ("version" >= 1);

-- Hallazgo ALTO "brecha contractual con CON-02": toda consulta nueva
-- (CON02) persiste el snapshot obligatorio de CON-02 - canal
-- (DAT-CON-004), nacionalidad (DAT-CON-002), destino y tiempo estimado
-- (DAT-CON-003) y cliente formal o, en su defecto, nombre del prospecto
-- (CON-P02). Solo los stubs heredados de PR#6 quedan exentos.
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_con02_snapshot_check" CHECK (
    "data_origin" = 'LEGACY_STUB'
    OR (
        "channel" IS NOT NULL
        AND "nationality" IS NOT NULL
        AND "destination" IS NOT NULL
        AND "estimated_days" IS NOT NULL
        AND ("customer_id" IS NOT NULL OR "prospect_name" IS NOT NULL)
    )
);

-- DAT-CON-003 / CON-02: dias y personas, si se informan, son positivos.
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_estimated_days_check" CHECK ("estimated_days" IS NULL OR "estimated_days" > 0);
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_party_size_check" CHECK ("party_size" IS NULL OR "party_size" > 0);

-- SC-CON-001.03: la fecha de ingreso al pais solo aplica a EXTRANJERO.
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_country_entry_date_check" CHECK (
    "country_entry_date" IS NULL OR "nationality" = 'EXTRANJERO'
);

-- CON-P07/BR-CON-005: dias cotizados y monto siempre positivos.
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_estimated_days_check" CHECK ("estimated_days" > 0);
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_amount_check" CHECK ("amount" > 0);
