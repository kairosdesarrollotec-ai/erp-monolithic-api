-- Migration: search_trgm_indexes
-- BUS-01 (TDD-BUS-001 §3) — Índices trigram para búsqueda global eficiente.
-- Requiere extensión pg_trgm (disponible en PostgreSQL y Cloud SQL).
-- Forward-only. Reversión: DROP INDEX IF EXISTS + DROP EXTENSION IF EXISTS pg_trgm.
-- Nota: se omite CONCURRENTLY porque Prisma Migrate envuelve cada migración en una
-- transacción y CREATE INDEX CONCURRENTLY no puede correr dentro de un bloque BEGIN/COMMIT
-- (error 25001). El lock de escritura durante el deploy es aceptable en tablas vacías (CI)
-- y breve en producción durante el deployment window.
--
-- search_path: Supabase instala extensiones en el schema 'extensions', no en 'public'.
-- SET search_path aquí garantiza que gin_trgm_ops sea visible en ambos entornos
-- (CI local usa 'public'; Supabase usa 'extensions').
SET search_path TO public, extensions;

-- Habilitar extensión pg_trgm
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Rentals: búsqueda futura por campo code cuando se agregue (TDD-BUS-001 nota)
-- Por ahora los índices en customers/vehicles cubren los JOINs de rentals y reservations.

-- Clientes: nombre completo y número de documento
CREATE INDEX IF NOT EXISTS idx_customers_fullname_trgm
  ON customers USING GIN (full_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_customers_docnumber_trgm
  ON customers USING GIN (document_number gin_trgm_ops);

-- Vehículos: placa (marca y modelo son texto corto, ILIKE en tablas pequeñas es aceptable)
CREATE INDEX IF NOT EXISTS idx_vehicles_plate_trgm
  ON vehicles USING GIN (plate gin_trgm_ops);

-- Índice adicional para email de clientes (campo opcional pero buscable)
CREATE INDEX IF NOT EXISTS idx_customers_email_trgm
  ON customers USING GIN (email gin_trgm_ops)
  WHERE email IS NOT NULL;
