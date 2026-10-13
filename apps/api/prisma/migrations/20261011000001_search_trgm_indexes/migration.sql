-- Migration: search_trgm_indexes
-- BUS-01 (TDD-BUS-001 §3) — Índices trigram para búsqueda global eficiente.
-- Requiere extensión pg_trgm (disponible en PostgreSQL y Cloud SQL).
-- Forward-only. Reversión: DROP INDEX IF EXISTS + DROP EXTENSION IF EXISTS pg_trgm.
-- Nota: se omite CONCURRENTLY porque Prisma Migrate envuelve cada migración en una
-- transacción y CREATE INDEX CONCURRENTLY no puede correr dentro de un bloque BEGIN/COMMIT
-- (error 25001). El lock de escritura durante el deploy es aceptable en tablas vacías (CI)
-- y breve en producción durante el deployment window.
--
-- Compatibilidad de schema: en PostgreSQL local (CI) pg_trgm se instala en 'public';
-- en Supabase se instala en 'extensions'. El bloque DO detecta el schema dinámicamente
-- y usa el nombre calificado en cada CREATE INDEX, eliminando toda dependencia de
-- search_path o configuración de entorno.

-- Habilitar extensión pg_trgm (no-op si ya existe, p.ej. en Supabase)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

DO $$
DECLARE
  trgm_schema text;
BEGIN
  -- Detectar en qué schema está gin_trgm_ops (varía por entorno)
  SELECT n.nspname INTO trgm_schema
  FROM pg_opclass oc
  JOIN pg_namespace n ON n.oid = oc.opcnamespace
  WHERE oc.opcname = 'gin_trgm_ops'
  LIMIT 1;

  IF trgm_schema IS NULL THEN
    RAISE EXCEPTION 'gin_trgm_ops not found — ensure pg_trgm extension is installed';
  END IF;

  EXECUTE format(
    'CREATE INDEX IF NOT EXISTS idx_customers_fullname_trgm ON customers USING GIN (full_name %I.gin_trgm_ops)',
    trgm_schema
  );

  EXECUTE format(
    'CREATE INDEX IF NOT EXISTS idx_customers_docnumber_trgm ON customers USING GIN (document_number %I.gin_trgm_ops)',
    trgm_schema
  );

  EXECUTE format(
    'CREATE INDEX IF NOT EXISTS idx_vehicles_plate_trgm ON vehicles USING GIN (plate %I.gin_trgm_ops)',
    trgm_schema
  );

  EXECUTE format(
    'CREATE INDEX IF NOT EXISTS idx_customers_email_trgm ON customers USING GIN (email %I.gin_trgm_ops) WHERE email IS NOT NULL',
    trgm_schema
  );
END $$;
