-- CONFLICT-CON-001 (resuelto): `POST /reservations` crea reservas directamente,
-- sin requerir una consulta previa. `convert-to-reservation` sigue siendo la
-- via cuando la reserva se origina en una Consulta COTIZADA.
--
-- Cambios:
--   1) inquiry_id pasa de NOT NULL a nullable en `reservations`.
--   2) Se reemplaza la FK compuesta (inquiry_id, operating_company_id) por una
--      FK simple sobre inquiry_id solo, porque Prisma no admite una relacion
--      opcional sobre una FK compuesta con un campo obligatorio. El aislamiento
--      empresa<>consulta ahora se valida en el handler cuando inquiryId llega.
--
-- El UNIQUE en inquiry_id se conserva: garantiza que una Consulta se convierte
-- a lo sumo una vez. PostgreSQL UNIQUE trata cada NULL como distinto, por lo
-- que multiples reservas sin consulta coexisten sin violar la restriccion.

-- 1) Eliminar FK compuesta anterior
ALTER TABLE "reservations"
  DROP CONSTRAINT IF EXISTS "reservations_inquiry_id_operating_company_id_fkey";

-- 2) Hacer la columna nullable
ALTER TABLE "reservations"
  ALTER COLUMN "inquiry_id" DROP NOT NULL;

-- 3) Recrear como FK simple (solo inquiry_id)
ALTER TABLE "reservations"
  ADD CONSTRAINT "reservations_inquiry_id_fkey"
  FOREIGN KEY ("inquiry_id")
  REFERENCES "inquiries"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;
