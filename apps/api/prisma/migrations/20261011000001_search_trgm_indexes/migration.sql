-- Migration: search_trgm_indexes
-- BUS-01 (TDD-BUS-001 §3) — Índices trigram para búsqueda global eficiente.
-- Requiere extensión pg_trgm (disponible en PostgreSQL y Cloud SQL).
-- Los índices CONCURRENTLY son seguros en producción: no bloquean lecturas ni escrituras.
-- Forward-only. Reversión: DROP INDEX CONCURRENTLY IF EXISTS + DROP EXTENSION IF EXISTS pg_trgm.

-- Habilitar extensión pg_trgm
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Rentals: búsqueda futura por campo code cuando se agregue (TDD-BUS-001 nota)
-- Por ahora los índices en customers/vehicles cubren los JOINs de rentals y reservations.

-- Clientes: nombre completo y número de documento
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_fullname_trgm
  ON customers USING GIN (full_name gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_docnumber_trgm
  ON customers USING GIN (document_number gin_trgm_ops);

-- Vehículos: placa (marca y modelo son texto corto, ILIKE en tablas pequeñas es aceptable)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vehicles_plate_trgm
  ON vehicles USING GIN (plate gin_trgm_ops);

-- Índice adicional para email de clientes (campo opcional pero buscable)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_email_trgm
  ON customers USING GIN (email gin_trgm_ops)
  WHERE email IS NOT NULL;
