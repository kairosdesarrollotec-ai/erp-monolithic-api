-- CONFLICT-CON-002 (resuelto): la identidad del prospecto (nombre, documento,
-- nacionalidad, fecha de ingreso) se persiste en `customers`, no en `inquiries`.
-- Al registrar una Consulta sin cliente formal, RegisterInquiryHandler crea
-- primero el Customer con estos campos; el customerId resultante va en
-- Inquiry.customer_id. Inquiry conserva solo el contexto del viaje
-- (destination, estimated_days, travel_start_date, party_size).
--
-- TDD-CON-001.md seccion 9.2 muestra `inquiries` SIN campos de snapshot de
-- prospecto; la implementacion previa (PR#7) los habia agregado derivando del
-- BDD/UX pero sin fuente explicita en el TDD. La decision documentada en
-- decision-log.md (CONFLICT-CON-002) establece customers como autoridad.

-- ============================================================
-- 0) VERIFICACION PREVIA
-- ============================================================
DO $$
DECLARE
  orphan_prospects integer;
BEGIN
  -- Consultas CON02 con datos de prospecto (no migrados a Customer) sin customerId.
  -- En desarrollo estas filas no deberian existir; se aborta si las hay.
  SELECT count(*) INTO orphan_prospects
    FROM "inquiries"
    WHERE "data_origin" = 'CON02'
      AND "customer_id" IS NULL
      AND "prospect_name" IS NOT NULL;
  IF orphan_prospects > 0 THEN
    RAISE EXCEPTION 'customers_prospect_identity: % consulta(s) CON02 tienen datos de prospecto sin customerId asociado. '
      'Migrarlas manualmente a la tabla customers antes de ejecutar esta migracion.',
      orphan_prospects;
  END IF;
END $$;

-- ============================================================
-- 1) EXPAND - nuevas columnas en customers (NULLABLE)
-- ============================================================
ALTER TABLE "customers"
  ADD COLUMN IF NOT EXISTS "nationality" "InquiryNationality",
  ADD COLUMN IF NOT EXISTS "country_entry_date" DATE;

-- ============================================================
-- 2) CHECK en customers: fecha de ingreso solo para EXTRANJERO
-- ============================================================
ALTER TABLE "customers"
  ADD CONSTRAINT "customers_country_entry_date_check"
  CHECK ("country_entry_date" IS NULL OR "nationality" = 'EXTRANJERO');

-- ============================================================
-- 3) Actualizar CHECK de inquiries (quitar nationality y prospect_name)
-- ============================================================
ALTER TABLE "inquiries"
  DROP CONSTRAINT IF EXISTS "inquiries_con02_snapshot_check";

-- Nueva version: customer_id siempre presente para CON02 (el prospecto
-- ya fue creado como Customer antes de llamar a RegisterInquiryHandler).
ALTER TABLE "inquiries"
  ADD CONSTRAINT "inquiries_con02_snapshot_check"
  CHECK (
    "data_origin" = 'LEGACY_STUB'
    OR (
      "channel" IS NOT NULL
      AND "customer_id" IS NOT NULL
      AND "destination" IS NOT NULL
      AND "estimated_days" IS NOT NULL
    )
  );

-- ============================================================
-- 4) Eliminar CHECK de inquiries que ya no aplica (nationality alli)
-- ============================================================
ALTER TABLE "inquiries"
  DROP CONSTRAINT IF EXISTS "inquiries_country_entry_date_check";

-- ============================================================
-- 5) DROP columnas de prospecto en inquiries
-- ============================================================
ALTER TABLE "inquiries"
  DROP COLUMN IF EXISTS "prospect_name",
  DROP COLUMN IF EXISTS "prospect_document_type",
  DROP COLUMN IF EXISTS "prospect_document_number",
  DROP COLUMN IF EXISTS "nationality",
  DROP COLUMN IF EXISTS "country_entry_date";
