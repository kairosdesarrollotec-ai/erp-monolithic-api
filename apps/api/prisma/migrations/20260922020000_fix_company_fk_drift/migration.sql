-- Seguimiento de revalidacion de PR#6 (comentario sobre b858120):
-- 20260921190000_add_reservations y 20260922000000_fix_company_organization_integrity
-- fueron restauradas byte a byte a su version historica ya aplicada
-- (commit d442508 y 5693872 respectivamente) - ver ese comentario para el
-- detalle de por que reescribirlas rompia el upgrade real desde una base
-- que ya las tenia aplicadas ("no existe constraint unica que coincida
-- con las claves dadas para la tabla companies" / columnas ausentes).
--
-- Esta es la migracion forward-only real que agrega el aislamiento
-- empresa/sede a customers/vehicles/inquiries (hallazgo ALTO "referencias
-- corregidas solo a nivel organizacion, no empresa/sede", revision PR#6)
-- y reemplaza las FKs simples de reservations por las compuestas. Sigue
-- el patron expand -> backfill -> verify -> contract (mismo patron que
-- 20260921180000_add_worker_role y 20260923000000_inquiries_expand_backfill_contract)
-- para no romper una base con datos existentes.

-- ============================================================
-- 0) VERIFICACION PREVIA (antes de modificar nada)
-- ============================================================
-- En este punto de la historia, customers/vehicles/inquiries solo se
-- crean como "stub" desde el flujo de conversion de una Reserva
-- (ver nota de 20260921190000) - toda fila existente tiene exactamente
-- una reserva asociada, de la que se puede derivar su empresa de forma
-- verificable. Se aborta si esa premisa no se cumple, en vez de inventar
-- un valor (CLAUDE.md seccion 4).
DO $$
DECLARE
  orphan_customers integer;
  orphan_vehicles integer;
  orphan_inquiries integer;
  ambiguous_customers integer;
  ambiguous_vehicles integer;
  ambiguous_inquiries integer;
BEGIN
  SELECT count(*) INTO orphan_customers FROM "customers" c
    WHERE NOT EXISTS (SELECT 1 FROM "reservations" r WHERE r."customer_id" = c."id");
  SELECT count(*) INTO orphan_vehicles FROM "vehicles" v
    WHERE NOT EXISTS (SELECT 1 FROM "reservations" r WHERE r."vehicle_id" = v."id");
  SELECT count(*) INTO orphan_inquiries FROM "inquiries" i
    WHERE NOT EXISTS (SELECT 1 FROM "reservations" r WHERE r."inquiry_id" = i."id");
  IF orphan_customers + orphan_vehicles + orphan_inquiries > 0 THEN
    RAISE EXCEPTION 'fix_company_fk_drift: % cliente(s), % vehiculo(s) y % consulta(s) sin reserva asociada - no hay fuente verificable de empresa para backfillearlos. Revisar manualmente antes de migrar.',
      orphan_customers, orphan_vehicles, orphan_inquiries;
  END IF;

  SELECT count(*) INTO ambiguous_customers FROM (
    SELECT r."customer_id" FROM "reservations" r GROUP BY r."customer_id" HAVING count(DISTINCT r."operating_company_id") > 1
  ) d;
  SELECT count(*) INTO ambiguous_vehicles FROM (
    SELECT r."vehicle_id" FROM "reservations" r GROUP BY r."vehicle_id" HAVING count(DISTINCT r."operating_company_id") > 1
  ) d;
  SELECT count(*) INTO ambiguous_inquiries FROM (
    SELECT r."inquiry_id" FROM "reservations" r GROUP BY r."inquiry_id" HAVING count(DISTINCT r."operating_company_id") > 1
  ) d;
  IF ambiguous_customers + ambiguous_vehicles + ambiguous_inquiries > 0 THEN
    RAISE EXCEPTION 'fix_company_fk_drift: % cliente(s), % vehiculo(s) y % consulta(s) tienen reservas con mas de una empresa distinta - no se puede derivar una unica operating_company_id. Resolver manualmente antes de migrar.',
      ambiguous_customers, ambiguous_vehicles, ambiguous_inquiries;
  END IF;
END $$;

-- ============================================================
-- 1) EXPAND - columna nueva, NULLABLE
-- ============================================================
ALTER TABLE "customers" ADD COLUMN "operating_company_id" TEXT;
ALTER TABLE "vehicles" ADD COLUMN "operating_company_id" TEXT;
ALTER TABLE "inquiries" ADD COLUMN "operating_company_id" TEXT;

-- ============================================================
-- 2) BACKFILL - solo desde la reserva asociada (fuente verificable,
--    ya confirmada unica en el paso 0)
-- ============================================================
UPDATE "customers" c SET "operating_company_id" = r."operating_company_id"
  FROM "reservations" r WHERE r."customer_id" = c."id";

UPDATE "vehicles" v SET "operating_company_id" = r."operating_company_id"
  FROM "reservations" r WHERE r."vehicle_id" = v."id";

UPDATE "inquiries" i SET "operating_company_id" = r."operating_company_id"
  FROM "reservations" r WHERE r."inquiry_id" = i."id";

-- ============================================================
-- 3) VERIFY - ninguna fila puede quedar sin backfill
-- ============================================================
DO $$
DECLARE
  incomplete integer;
BEGIN
  SELECT count(*) INTO incomplete FROM "customers" WHERE "operating_company_id" IS NULL;
  IF incomplete > 0 THEN
    RAISE EXCEPTION 'fix_company_fk_drift: % cliente(s) quedaron sin operating_company_id tras el backfill.', incomplete;
  END IF;
  SELECT count(*) INTO incomplete FROM "vehicles" WHERE "operating_company_id" IS NULL;
  IF incomplete > 0 THEN
    RAISE EXCEPTION 'fix_company_fk_drift: % vehiculo(s) quedaron sin operating_company_id tras el backfill.', incomplete;
  END IF;
  SELECT count(*) INTO incomplete FROM "inquiries" WHERE "operating_company_id" IS NULL;
  IF incomplete > 0 THEN
    RAISE EXCEPTION 'fix_company_fk_drift: % consulta(s) quedaron sin operating_company_id tras el backfill.', incomplete;
  END IF;
END $$;

-- ============================================================
-- 4) CONTRACT - obligatoriedad, indices y FKs compuestas definitivas
-- ============================================================
ALTER TABLE "customers" ALTER COLUMN "operating_company_id" SET NOT NULL;
ALTER TABLE "vehicles" ALTER COLUMN "operating_company_id" SET NOT NULL;
ALTER TABLE "inquiries" ALTER COLUMN "operating_company_id" SET NOT NULL;

-- CreateIndex (soporte de las FKs compuestas de reservations hacia estas
-- 3 tablas, y del @@unique/@@index de schema.prisma)
CREATE UNIQUE INDEX "customers_id_operating_company_id_key" ON "customers"("id", "operating_company_id");
CREATE INDEX "customers_operating_company_id_idx" ON "customers"("operating_company_id");
CREATE UNIQUE INDEX "vehicles_id_operating_company_id_key" ON "vehicles"("id", "operating_company_id");
CREATE INDEX "vehicles_operating_company_id_idx" ON "vehicles"("operating_company_id");
CREATE UNIQUE INDEX "inquiries_id_operating_company_id_key" ON "inquiries"("id", "operating_company_id");
CREATE INDEX "inquiries_operating_company_id_idx" ON "inquiries"("operating_company_id");

-- AddForeignKey - customers/vehicles/inquiries -> companies(id, organization_id)
-- (companies_id_organization_id_key ya existe, creada por
-- 20260922000000_fix_company_organization_integrity, que corre antes)
ALTER TABLE "customers" ADD CONSTRAINT "customers_operating_company_id_organization_id_fkey" FOREIGN KEY ("operating_company_id", "organization_id") REFERENCES "companies"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_operating_company_id_organization_id_fkey" FOREIGN KEY ("operating_company_id", "organization_id") REFERENCES "companies"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_operating_company_id_organization_id_fkey" FOREIGN KEY ("operating_company_id", "organization_id") REFERENCES "companies"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Reemplaza las FKs simples de reservations (creadas por
-- 20260921190000_add_reservations, ya restaurada a su forma historica)
-- por las compuestas hacia (id, operating_company_id) de cada tabla -
-- cierra el IDOR cross-company que la FK simple no evitaba (hallazgo
-- ALTO "referencias corregidas solo a nivel organizacion, no
-- empresa/sede").
ALTER TABLE "reservations" DROP CONSTRAINT "reservations_inquiry_id_fkey";
ALTER TABLE "reservations" DROP CONSTRAINT "reservations_customer_id_fkey";
ALTER TABLE "reservations" DROP CONSTRAINT "reservations_vehicle_id_fkey";

ALTER TABLE "reservations" ADD CONSTRAINT "reservations_inquiry_id_operating_company_id_fkey" FOREIGN KEY ("inquiry_id", "operating_company_id") REFERENCES "inquiries"("id", "operating_company_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_customer_id_operating_company_id_fkey" FOREIGN KEY ("customer_id", "operating_company_id") REFERENCES "customers"("id", "operating_company_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_vehicle_id_operating_company_id_fkey" FOREIGN KEY ("vehicle_id", "operating_company_id") REFERENCES "vehicles"("id", "operating_company_id") ON DELETE RESTRICT ON UPDATE CASCADE;
