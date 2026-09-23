-- Correccion detectada en la revalidacion de PR#7 (23 sep 2026): drift
-- entre schema.prisma y las migraciones de PR#6.
--
-- schema.prisma declara Customer.operatingCompany, Vehicle.operatingCompany
-- e Inquiry.operatingCompany como FK COMPUESTA
-- (operating_company_id, organization_id) -> companies(id, organization_id)
-- (hallazgo ALTO de seguimiento de PR#6, mismo patron que PR#4), pero
-- 20260921190000_add_reservations las creo como FK SIMPLE
-- (operating_company_id) -> companies(id). Consecuencias:
--   1) la base NO impedia que organization_id de un cliente/vehiculo/
--      consulta contradijera al organization_id real de su empresa;
--   2) `prisma migrate dev` / `prisma migrate diff` detectan drift y
--      proponen esta misma correccion.
-- Se reemplaza cada FK simple por la compuesta. Incremental (no edita la
-- migracion ya aplicada) para que funcione sobre bases existentes.
--
-- Guarda previa: si alguna fila existente ya tiene organization_id
-- inconsistente con su empresa, la FK nueva no se puede crear - se aborta
-- con un mensaje explicito en vez de un error generico de Postgres.
DO $$
DECLARE
  bad_customers integer;
  bad_vehicles integer;
  bad_inquiries integer;
BEGIN
  SELECT count(*) INTO bad_customers FROM "customers" x
    LEFT JOIN "companies" c ON c."id" = x."operating_company_id" AND c."organization_id" = x."organization_id"
    WHERE c."id" IS NULL;
  SELECT count(*) INTO bad_vehicles FROM "vehicles" x
    LEFT JOIN "companies" c ON c."id" = x."operating_company_id" AND c."organization_id" = x."organization_id"
    WHERE c."id" IS NULL;
  SELECT count(*) INTO bad_inquiries FROM "inquiries" x
    LEFT JOIN "companies" c ON c."id" = x."operating_company_id" AND c."organization_id" = x."organization_id"
    WHERE c."id" IS NULL;
  IF bad_customers + bad_vehicles + bad_inquiries > 0 THEN
    RAISE EXCEPTION 'fix_company_fk_drift: % clientes, % vehiculos y % consultas tienen organization_id distinto al de su empresa (operating_company_id). Corregir esos datos antes de migrar.',
      bad_customers, bad_vehicles, bad_inquiries;
  END IF;
END $$;

-- DropForeignKey
ALTER TABLE "customers" DROP CONSTRAINT "customers_operating_company_id_fkey";
ALTER TABLE "vehicles" DROP CONSTRAINT "vehicles_operating_company_id_fkey";
ALTER TABLE "inquiries" DROP CONSTRAINT "inquiries_operating_company_id_fkey";

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_operating_company_id_organization_id_fkey" FOREIGN KEY ("operating_company_id", "organization_id") REFERENCES "companies"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_operating_company_id_organization_id_fkey" FOREIGN KEY ("operating_company_id", "organization_id") REFERENCES "companies"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_operating_company_id_organization_id_fkey" FOREIGN KEY ("operating_company_id", "organization_id") REFERENCES "companies"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
