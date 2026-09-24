#!/usr/bin/env bash
# Hallazgo CRITICO de revision de seguimiento de PR#5 (12fc688): "Añadir
# prueba de migración sobre PostgreSQL con al menos una asignación
# preexistente". Este script reproduce ese escenario contra un Postgres
# real (el mismo contenedor kairos-postgres del docker-compose.yml de la
# raiz), en una base de datos DESECHABLE aparte de kairos_dev - no toca
# datos locales de desarrollo.
#
# Que hace:
#   1) crea una base de datos vacia kairos_migration_test
#   2) aplica la migracion 20260918000000_init (crea companies, branches,
#      user_company_assignments SIN columna role todavia)
#   3) inserta una company/branch/user_company_assignments de prueba -
#      esto simula un entorno con datos preexistentes ANTES de que
#      exista la columna role
#   4) aplica la migracion 20260921180000_add_worker_role (la que agrega
#      role) - si el ALTER TABLE ... NOT NULL sin backfill todavia
#      estuviera roto, este paso fallaria aqui mismo
#   5) verifica que la fila preexistente quedo con role = 'FRONT_OFFICE'
#      (el backfill) y que la columna es NOT NULL
#   6) borra la base de datos desechable
#
# Uso: bash apps/api/scripts/verify-worker-role-migration.sh
# (correr desde la raiz del repo, con kairos-postgres levantado)

set -euo pipefail

CONTAINER="kairos-postgres"
DB_USER="kairos"
TEST_DB="kairos_migration_test"
MIGRATIONS_DIR="apps/api/prisma/migrations"

echo "==> Recreando base de datos desechable ${TEST_DB}..."
docker exec -i "$CONTAINER" psql -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS ${TEST_DB};"
docker exec -i "$CONTAINER" psql -U "$DB_USER" -d postgres -c "CREATE DATABASE ${TEST_DB};"

echo "==> Aplicando migracion base (sin columna role todavia)..."
docker exec -i "$CONTAINER" psql -U "$DB_USER" -d "$TEST_DB" < "${MIGRATIONS_DIR}/20260918000000_init/migration.sql"
docker exec -i "$CONTAINER" psql -U "$DB_USER" -d "$TEST_DB" < "${MIGRATIONS_DIR}/20260918210725_init/migration.sql"

echo "==> Insertando una asignacion PREEXISTENTE (antes de que exista role)..."
docker exec -i "$CONTAINER" psql -U "$DB_USER" -d "$TEST_DB" -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO companies (id, organization_id, name, created_at, updated_at)
VALUES ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'Empresa preexistente', now(), now());

INSERT INTO branches (id, company_id, name, created_at, updated_at)
VALUES ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Sede preexistente', now(), now());

INSERT INTO user_company_assignments (id, organization_id, firebase_uid, company_id, branch_id, active, valid_from, created_at)
VALUES ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'uid-preexistente', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', true, now(), now());
SQL

echo "==> Aplicando la migracion que agrega role (aqui fallaba antes del fix)..."
docker exec -i "$CONTAINER" psql -U "$DB_USER" -d "$TEST_DB" -v ON_ERROR_STOP=1 < "${MIGRATIONS_DIR}/20260921180000_add_worker_role/migration.sql"

echo "==> Verificando que la fila preexistente quedo backfillada..."
RESULT=$(docker exec -i "$CONTAINER" psql -U "$DB_USER" -d "$TEST_DB" -t -A -c "SELECT role FROM user_company_assignments WHERE id = '33333333-3333-3333-3333-333333333333';")
if [ "$RESULT" != "FRONT_OFFICE" ]; then
  echo "FALLO: se esperaba role=FRONT_OFFICE en la fila preexistente, se obtuvo '${RESULT}'"
  docker exec -i "$CONTAINER" psql -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS ${TEST_DB};" >/dev/null
  exit 1
fi
echo "OK: fila preexistente backfillada a role=${RESULT}"

echo "==> Verificando que la columna quedo NOT NULL..."
NOTNULL=$(docker exec -i "$CONTAINER" psql -U "$DB_USER" -d "$TEST_DB" -t -A -c "SELECT is_nullable FROM information_schema.columns WHERE table_name = 'user_company_assignments' AND column_name = 'role';")
if [ "$NOTNULL" != "NO" ]; then
  echo "FALLO: se esperaba is_nullable=NO en user_company_assignments.role, se obtuvo '${NOTNULL}'"
  docker exec -i "$CONTAINER" psql -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS ${TEST_DB};" >/dev/null
  exit 1
fi
echo "OK: user_company_assignments.role es NOT NULL"

echo "==> Limpiando base de datos desechable..."
docker exec -i "$CONTAINER" psql -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS ${TEST_DB};"

echo ""
echo "EXITO: la migracion 20260921180000_add_worker_role es segura sobre una tabla con datos preexistentes."
