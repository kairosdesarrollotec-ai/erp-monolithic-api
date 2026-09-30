-- Hallazgo MEDIO PR#34 (Finding #7): CreateCustomerHandler usaba SELECT + INSERT
-- sin restriccion unica, permitiendo duplicados bajo concurrencia.
-- Correccion: restriccion UNIQUE (operating_company_id, document_type, document_number).
--
-- Deduplicacion previa: elimina filas duplicadas conservando la mas reciente
-- (por created_at DESC, id DESC). Solo elimina filas sin referencias activas
-- en inquiries ni reservations para no violar integridad referencial.
-- Si quedan duplicados con referencias dependientes la migracion fallara; en
-- ese caso fusionar manualmente esos registros antes de re-ejecutar.

WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY operating_company_id, document_type, document_number
           ORDER BY created_at DESC, id DESC
         ) AS rn
  FROM customers
)
DELETE FROM customers
WHERE id IN (
  SELECT r.id FROM ranked r
  WHERE r.rn > 1
    AND NOT EXISTS (SELECT 1 FROM inquiries    WHERE customer_id = r.id)
    AND NOT EXISTS (SELECT 1 FROM reservations WHERE customer_id = r.id)
);

-- Nombre generado por Prisma (63 caracteres, truncado desde el medio para preservar _key).
-- PostgreSQL truncaria a "...document_number_ke" si se usara el nombre sin truncar;
-- esa discrepancia genera drift en `prisma migrate diff`. Se usa el nombre exacto de Prisma.
CREATE UNIQUE INDEX IF NOT EXISTS "customers_operating_company_id_document_type_document_numbe_key"
  ON "customers"("operating_company_id", "document_type", "document_number");
