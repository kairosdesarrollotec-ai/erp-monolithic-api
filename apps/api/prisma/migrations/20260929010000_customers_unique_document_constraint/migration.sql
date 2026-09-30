-- Hallazgo MEDIO PR#34 (Finding #7): CreateCustomerHandler usaba SELECT + INSERT
-- sin restriccion unica, permitiendo duplicados bajo concurrencia.
-- Correccion: restriccion UNIQUE (operating_company_id, document_type, document_number).
-- Si existen duplicados previos esta migracion fallara; en ese caso resolver duplicados
-- primero (conservar el mas reciente y eliminar el anterior, o fusionar).

CREATE UNIQUE INDEX IF NOT EXISTS "customers_operating_company_id_document_type_document_number_key"
  ON "customers"("operating_company_id", "document_type", "document_number");
