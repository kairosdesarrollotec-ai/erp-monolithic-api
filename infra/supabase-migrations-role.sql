-- =============================================================================
-- KAIROS ERP — Setup del rol de migraciones (Supabase / PostgreSQL 15)
-- =============================================================================
-- Propósito: crear un rol dedicado (kairos_migrations) con los privilegios
-- mínimos necesarios para que prisma migrate deploy pueda:
--   · Crear y modificar tablas, índices, secuencias y constraints.
--   · Gestionar _prisma_migrations (tabla de control de Prisma).
--   · Ejecutar CREATE EXTENSION IF NOT EXISTS pg_trgm (idempotente si ya
--     está habilitada desde el Dashboard; sin requerir SUPERUSER porque
--     pg_trgm es una trusted extension en PostgreSQL 15).
--
-- INSTRUCCIONES (ejecutar UNA SOLA VEZ por ambiente):
--   1. Supabase Dashboard → SQL Editor (conecta como postgres superuser).
--   2. Generar una contraseña segura (≥ 32 caracteres, alfanumérica + símbolos).
--   3. Reemplazar el placeholder 'REPLACE_WITH_STRONG_PASSWORD' por esa contraseña.
--   4. Ejecutar el script completo.
--   5. Guardar la contraseña en el gestor de secretos del equipo.
--   6. Actualizar el secreto DIRECT_URL de cada ambiente en GitHub con:
--        postgresql://kairos_migrations:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
--      (puerto 5432 — conexión directa, NO el pooler en 6543).
--
-- NOTA pg_trgm:
--   Habilitar pg_trgm UNA SOLA VEZ vía Supabase Dashboard > Database > Extensions
--   (o vía SQL como postgres: CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA extensions;)
--   Una vez instalada, el CREATE EXTENSION IF NOT EXISTS pg_trgm de la migración
--   20261011000001_search_trgm_indexes es idempotente y no requiere privilegio adicional.
--
-- Decisión registrada en: docs/decision-log.md (INFRA-001)
-- =============================================================================

-- 1. Crear el rol
CREATE ROLE kairos_migrations WITH
  LOGIN
  PASSWORD 'REPLACE_WITH_STRONG_PASSWORD'
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOINHERIT
  CONNECTION LIMIT 5;        -- máx. 5 conexiones simultáneas (runs concurrentes en CI)

-- 2. Acceso a la base de datos
GRANT CONNECT ON DATABASE postgres TO kairos_migrations;

-- 3. Privilegios DDL en schema public
--    · CREATE: para CREATE TABLE, CREATE INDEX, CREATE SEQUENCE.
--    · USAGE: para resolver objetos existentes en el schema.
GRANT USAGE, CREATE ON SCHEMA public TO kairos_migrations;

-- 4. Acceso a los objetos ya existentes
--    Necesario para ALTER TABLE, migraciones forward-fix sobre tablas ya creadas.
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO kairos_migrations;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO kairos_migrations;

-- 5. Default privileges — todo objeto que kairos_migrations cree en el futuro
--    hereda los mismos permisos (evita tener que re-ejecutar GRANTs tras cada deploy).
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO kairos_migrations;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO kairos_migrations;

-- 6. search_path: incluir schema extensions (donde Supabase instala pg_trgm y otras
--    extensiones trusted). Sin esto, gin_trgm_ops no es visible al crear índices GIN.
ALTER ROLE kairos_migrations SET search_path TO public, extensions;

-- 7. Si la base de datos ya tiene tablas creadas por otro rol (p.ej. postgres en un
--    ambiente de desarrollo con historial previo), transferir ownership antes de correr
--    las migraciones. En una base de datos virgen este paso no es necesario.
--
--    REQUISITO PREVIO: el rol que ejecuta este script (postgres) debe ser miembro de
--    kairos_migrations. Ejecutar primero:
--        GRANT kairos_migrations TO postgres;
--
--    Luego ejecutar la transferencia:
--        DO $$
--        DECLARE r record;
--        BEGIN
--          FOR r IN
--            SELECT tablename FROM pg_tables
--            WHERE schemaname = 'public' AND tableowner = 'postgres'
--          LOOP
--            EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' OWNER TO kairos_migrations';
--          END LOOP;
--        END $$;

-- 8. Verificar la creación
SELECT
  rolname,
  rolcanlogin,
  rolsuper,
  rolcreatedb,
  rolcreaterole,
  rolconnlimit
FROM pg_roles
WHERE rolname = 'kairos_migrations';

-- Output esperado:
--  rolname           | rolcanlogin | rolsuper | rolcreatedb | rolcreaterole | rolconnlimit
--  kairos_migrations |      t      |    f     |      f      |       f       |      5

-- 9. Verificar search_path configurado
SELECT rolname, rolconfig FROM pg_roles WHERE rolname = 'kairos_migrations';
-- Output esperado: rolconfig = {search_path=public, extensions}
