-- Hallazgo MEDIO PR#34 (Finding #7): CreateCustomerHandler usaba SELECT + INSERT
-- sin restriccion unica, permitiendo duplicados bajo concurrencia.
-- Correccion: restriccion UNIQUE (operating_company_id, document_type, document_number).
--
-- Deduplicacion previa: para cada grupo duplicado conserva la fila mas
-- reciente (created_at DESC, id DESC como desempate), reasigna las referencias
-- de inquiries y reservations al registro keeper, luego elimina el duplicado.
-- Este orden evita violar restricciones de integridad referencial.

DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    WITH ranked AS (
      SELECT id,
             FIRST_VALUE(id) OVER (
               PARTITION BY operating_company_id, document_type, document_number
               ORDER BY created_at DESC, id DESC
             ) AS keeper_id,
             ROW_NUMBER() OVER (
               PARTITION BY operating_company_id, document_type, document_number
               ORDER BY created_at DESC, id DESC
             ) AS rn
      FROM customers
    )
    SELECT id, keeper_id FROM ranked WHERE rn > 1
  LOOP
    UPDATE inquiries    SET customer_id = rec.keeper_id WHERE customer_id = rec.id;
    UPDATE reservations SET customer_id = rec.keeper_id WHERE customer_id = rec.id;
    DELETE FROM customers WHERE id = rec.id;
  END LOOP;
END;
$$;

-- Nombre generado por Prisma (63 caracteres, truncado desde el medio para preservar _key).
-- PostgreSQL truncaria a "...document_number_ke" si se usara el nombre sin truncar;
-- esa discrepancia genera drift en `prisma migrate diff`. Se usa el nombre exacto de Prisma.
CREATE UNIQUE INDEX IF NOT EXISTS "customers_operating_company_id_document_type_document_numbe_key"
  ON "customers"("operating_company_id", "document_type", "document_number");
