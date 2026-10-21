-- Mantiene el DDL alineado con Prisma: `updated_at` se gestiona mediante
-- @updatedAt en la aplicacion, por lo que no debe conservar un DEFAULT en BD.
-- Esta migracion es aditiva para no reescribir el historial ya aplicado de
-- 20261019000900_hr_areas_catalog.
ALTER TABLE "hr_areas" ALTER COLUMN "updated_at" DROP DEFAULT;
