-- Hallazgo medio de revision PR#5: agrega el rol PROVISIONAL de
-- HU-24/TR-06 (WorkerRole) como migracion incremental, sin tocar la
-- migracion 20260918000000_init ya aplicada (PR#4). El modelo definitivo
-- de roles y permisos vive en ADM-02, todavia no construido.
--
-- Hallazgo CRITICO de revision de seguimiento de PR#5 (12fc688): la
-- version anterior de esta migracion hacia
-- `ADD COLUMN "role" "WorkerRole" NOT NULL` sin default ni backfill -
-- eso falla en cualquier entorno donde "user_company_assignments" ya
-- tenga filas (Postgres no permite agregar una columna NOT NULL sin
-- default a una tabla no vacia; las filas existentes quedarian en NULL
-- y el ALTER TABLE se rechaza). La prueba original se hizo con la tabla
-- vacia, por eso no lo detecto.
--
-- Se reescribe con el patron expand/backfill/contract:
--   1) expand: agrega la columna NULLABLE (sin NOT NULL todavia).
--   2) backfill: asigna un valor explicito a cada fila preexistente.
--      Hoy no existe ninguna fuente de datos de la que derivar el rol
--      REAL de cada usuario (el modelo definitivo de roles vive en
--      ADM-02, todavia no construido) - el valor de backfill elegido es
--      'FRONT_OFFICE' como PLACEHOLDER EXPLICITO Y DOCUMENTADO, nunca
--      implicito. Esto es seguro porque, segun el hallazgo alto de esta
--      misma revision ("validar contexto no equivale a RBAC/ABAC"),
--      `role` hoy solo enruta al tablero (GetDashboardHandler) y no
--      otorga ningun permiso diferenciado por rol todavia - pero
--      cualquier fila backfillada por esta migracion DEBE revisarse y
--      corregirse a mano antes de que ADM-02 use este campo para
--      autorizacion real.
--   3) verify: aborta la migracion si quedara alguna fila en NULL
--      despues del backfill (guarda defensiva, no deberia dispararse
--      nunca en la practica).
--   4) contract: recien aqui se aplica NOT NULL, con la garantia de que
--      cero filas quedan sin rol.

-- CreateEnum
CREATE TYPE "WorkerRole" AS ENUM ('ADMINISTRACION', 'AUDITORIA', 'CAMPO', 'FINANZAS', 'FRONT_OFFICE', 'GERENCIA', 'RRHH');

-- AlterTable (expand: columna nullable, todavia sin NOT NULL)
ALTER TABLE "user_company_assignments" ADD COLUMN "role" "WorkerRole";

-- Backfill: placeholder explicito documentado arriba (no es un mapeo de
-- negocio real, no existe fuente de datos de la que derivarlo hoy).
UPDATE "user_company_assignments" SET "role" = 'FRONT_OFFICE' WHERE "role" IS NULL;

-- Verify: guarda defensiva, nunca deberia dispararse.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "user_company_assignments" WHERE "role" IS NULL) THEN
    RAISE EXCEPTION 'Backfill de user_company_assignments.role dejo filas en NULL - abortando antes del contract (NOT NULL).';
  END IF;
END $$;

-- AlterTable (contract: ya no puede haber NULL, se aplica NOT NULL)
ALTER TABLE "user_company_assignments" ALTER COLUMN "role" SET NOT NULL;
