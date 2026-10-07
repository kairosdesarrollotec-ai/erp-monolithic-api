#!/usr/bin/env bash
# Prueba de UPGRADE de la migracion 20261007000000_dynamic_roles sobre
# PostgreSQL REAL con datos poblados (roles dinamicos, fase 2): el enum
# WorkerRole pasa a ser la tabla "roles", las asignaciones y las versiones de
# la matriz ADM-02 se remapean por organizacion y la columna enum queda
# deprecada.
#
# Requiere solo `psql` y un PostgreSQL accesible. Usa las variables estandar
# de libpq (PGHOST, PGPORT, PGUSER, PGPASSWORD). Crea y destruye sus propias
# bases temporales - nunca toca la base de desarrollo.
#
#   PGHOST=localhost PGPORT=5434 PGUSER=kairos PGPASSWORD=... \
#     bash apps/api/test/migrations/roles-upgrade.test.sh
#
# Casos:
#   1. Upgrade feliz con varias organizaciones: siembra 8 roles de sistema por
#      organizacion (tambien la que solo aparece en la matriz / perfiles) y
#      remapea asignaciones y celdas enum -> role_id SIN cruzar organizaciones.
#   2. Invariantes post-migracion: unicidad del nombre sin distinguir
#      mayusculas, CHECK de nombre/version, FK compuestas por organizacion,
#      CHECK de ambito, onDelete Restrict, columnas enum deprecadas nullable.
#   3. Base vacia: aplica sin errores y sin roles (los crea el seeder).
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
MIGRATIONS="$HERE/../../prisma/migrations"
TARGET="20261007000000_dynamic_roles"
PSQL=(psql -X -q -v ON_ERROR_STOP=1 -At)
FAILS=0
RUN_ID="$$"

pass() { echo "  PASS - $1"; }
fail() { echo "  FAIL - $1"; FAILS=$((FAILS + 1)); }

new_db() {
  local db="kairos_roles_${RUN_ID}_$1"
  "${PSQL[@]}" -d postgres -c "SET client_min_messages = warning" -c "DROP DATABASE IF EXISTS $db" -c "CREATE DATABASE $db" >/dev/null
  echo "$db"
}

drop_db() { "${PSQL[@]}" -d postgres -c "DROP DATABASE IF EXISTS $1" >/dev/null; }

# Aplica todas las migraciones ANTERIORES a TARGET, cada una en una transaccion
# (igual que `prisma migrate deploy` en PostgreSQL).
apply_before_target() {
  local db="$1"
  for dir in $(ls -d "$MIGRATIONS"/2026*/ | sort); do
    [[ "$(basename "$dir")" == "$TARGET" ]] && break
    "${PSQL[@]}" -1 -d "$db" -f "$dir/migration.sql" >/dev/null 2>&1
  done
}

apply_target() { "${PSQL[@]}" -1 -d "$1" -f "$MIGRATIONS/$TARGET/migration.sql" 2>&1; }

q() { "${PSQL[@]}" -d "$1" -c "$2"; }

# Devuelve 0 si la sentencia FALLA (la base rechazo lo que debia rechazar).
rejected() { ! q "$1" "$2" >/dev/null 2>&1; }

ORG_A=11111111-1111-1111-1111-11111111111a
ORG_B=11111111-1111-1111-1111-11111111111b
ORG_C=11111111-1111-1111-1111-11111111111c   # solo aparece en la matriz
ORG_D=11111111-1111-1111-1111-11111111111d   # solo aparece en user_profiles
CO_A=22222222-2222-2222-2222-22222222222a
CO_B=22222222-2222-2222-2222-22222222222b
BR_A=33333333-3333-3333-3333-33333333333a
BR_B=33333333-3333-3333-3333-33333333333b

seed_pre_state() {
  local db="$1"
  q "$db" "
    INSERT INTO companies (id, organization_id, name, updated_at) VALUES ('$CO_A', '$ORG_A', 'Empresa A', now()), ('$CO_B', '$ORG_B', 'Empresa B', now());
    INSERT INTO branches (id, company_id, name, updated_at) VALUES ('$BR_A', '$CO_A', 'Sede A', now()), ('$BR_B', '$CO_B', 'Sede B', now());
    INSERT INTO user_company_assignments (id, organization_id, firebase_uid, company_id, branch_id, role) VALUES
      ('asg-a1', '$ORG_A', 'uid-a1', '$CO_A', '$BR_A', 'ADMINISTRACION'),
      ('asg-a2', '$ORG_A', 'uid-a2', '$CO_A', '$BR_A', 'CAMPO'),
      ('asg-a3', '$ORG_A', 'uid-a3', '$CO_A', '$BR_A', 'PLATFORM_ADMIN'),
      ('asg-b1', '$ORG_B', 'uid-b1', '$CO_B', '$BR_B', 'GERENCIA');
    INSERT INTO role_permission_matrix_versions (id, organization_id, version, role, action, allowed, created_by) VALUES
      ('mx-a1', '$ORG_A', 1, 'FRONT_OFFICE', 'RESERVATION.CREATE', true,  'uid-a1'),
      ('mx-a2', '$ORG_A', 1, 'CAMPO',        'RESERVATION.CREATE', false, 'uid-a1'),
      ('mx-c1', '$ORG_C', 1, 'GERENCIA',     'RESERVATION.CREATE', true,  'uid-c1');
    INSERT INTO user_profiles (id, organization_id, firebase_uid, updated_at) VALUES ('up-d1', '$ORG_D', 'uid-d1', now());
  " >/dev/null
}

echo "Caso 1: upgrade feliz sobre base poblada con varias organizaciones"
DB=$(new_db happy)
apply_before_target "$DB"
seed_pre_state "$DB"

if out=$(apply_target "$DB"); then pass "la migracion aplica sobre una base poblada"; else fail "la migracion fallo: $out"; fi

per_org=$(q "$DB" "SELECT string_agg(organization_id || '=' || n, ',' ORDER BY organization_id) FROM (SELECT organization_id, count(*) AS n FROM roles WHERE is_system AND key IS NOT NULL AND active GROUP BY organization_id) t")
expected="$ORG_A=8,$ORG_B=8,$ORG_C=8,$ORG_D=8"
[[ "$per_org" == "$expected" ]] \
  && pass "8 roles de sistema por organizacion (incluidas las que solo aparecen en la matriz o en perfiles)" \
  || fail "roles sembrados inesperados: $per_org"

keys=$(q "$DB" "SELECT string_agg(key, ',' ORDER BY key) FROM roles WHERE organization_id = '$ORG_A'")
[[ "$keys" == "ADMINISTRACION,AUDITORIA,CAMPO,FINANZAS,FRONT_OFFICE,GERENCIA,PLATFORM_ADMIN,RRHH" ]] \
  && pass "las keys sembradas son exactamente los 8 valores del enum WorkerRole" || fail "keys inesperadas: $keys"

mapped=$(q "$DB" "SELECT string_agg(a.id || ':' || r.key || ':' || (r.organization_id = a.organization_id)::text, ',' ORDER BY a.id)
                  FROM user_company_assignments a JOIN roles r ON r.id = a.role_id")
[[ "$mapped" == "asg-a1:ADMINISTRACION:true,asg-a2:CAMPO:true,asg-a3:PLATFORM_ADMIN:true,asg-b1:GERENCIA:true" ]] \
  && pass "cada asignacion apunta al rol de su MISMA organizacion con la key del enum original" \
  || fail "backfill de asignaciones inesperado: $mapped"

cells=$(q "$DB" "SELECT string_agg(m.id || ':' || r.key || ':' || (r.organization_id = m.organization_id)::text || ':' || coalesce(m.company_id, '-'), ',' ORDER BY m.id)
                 FROM role_permission_matrix_versions m JOIN roles r ON r.id = m.role_id")
[[ "$cells" == "mx-a1:FRONT_OFFICE:true:-,mx-a2:CAMPO:true:-,mx-c1:GERENCIA:true:-" ]] \
  && pass "las celdas de la matriz se remapean a role_id por organizacion y quedan con ambito de organizacion (NULL)" \
  || fail "backfill de matriz inesperado: $cells"

nulls=$(q "$DB" "SELECT string_agg(table_name || '.' || column_name || '=' || is_nullable, ',' ORDER BY table_name, column_name)
                 FROM information_schema.columns
                 WHERE (table_name = 'user_company_assignments' AND column_name IN ('role', 'role_id'))
                    OR (table_name = 'role_permission_matrix_versions' AND column_name IN ('role', 'role_id', 'company_id', 'branch_id'))")
[[ "$nulls" == "role_permission_matrix_versions.branch_id=YES,role_permission_matrix_versions.company_id=YES,role_permission_matrix_versions.role=YES,role_permission_matrix_versions.role_id=NO,user_company_assignments.role=YES,user_company_assignments.role_id=NO" ]] \
  && pass "role_id NOT NULL; el enum role queda deprecado (nullable); ambito nullable" || fail "nulabilidad inesperada: $nulls"

idx=$(q "$DB" "SELECT string_agg(indexname, ',' ORDER BY indexname) FROM pg_indexes
               WHERE indexname IN ('roles_organization_id_lower_name_key', 'role_permission_matrix_org_version_role_id_action_key', 'role_permission_matrix_versions_organization_id_version_rol_key')")
[[ "$idx" == "role_permission_matrix_org_version_role_id_action_key,roles_organization_id_lower_name_key" ]] \
  && pass "indices: existen el unico funcional por nombre y el nuevo unico por role_id; el viejo (por enum) fue retirado" \
  || fail "indices inesperados: $idx"

echo "Caso 2: invariantes post-migracion"
ROLE_A_FO=$(q "$DB" "SELECT id FROM roles WHERE organization_id = '$ORG_A' AND key = 'FRONT_OFFICE'")
ROLE_B_FO=$(q "$DB" "SELECT id FROM roles WHERE organization_id = '$ORG_B' AND key = 'FRONT_OFFICE'")

if q "$DB" "INSERT INTO roles (id, organization_id, name, updated_at) VALUES ('r-custom', '$ORG_A', 'Supervisor', now())" >/dev/null 2>&1; then
  pass "un rol creado a mano (key NULL, is_system false) se acepta"
else
  fail "no se pudo crear un rol a mano"
fi
rejected "$DB" "INSERT INTO roles (id, organization_id, name, updated_at) VALUES ('r-dup', '$ORG_A', 'SUPERVISOR', now())" \
  && pass "el indice funcional rechaza un nombre repetido sin distinguir mayusculas" || fail "se acepto un nombre duplicado en distinta capitalizacion"
q "$DB" "INSERT INTO roles (id, organization_id, name, updated_at) VALUES ('r-other-org', '$ORG_B', 'Supervisor', now())" >/dev/null 2>&1 \
  && pass "el mismo nombre se acepta en OTRA organizacion" || fail "el mismo nombre en otra organizacion fue rechazado"
rejected "$DB" "INSERT INTO roles (id, organization_id, name, updated_at) VALUES ('r-sp', '$ORG_A', ' Con espacios ', now())" \
  && pass "CHECK roles_name_length_check rechaza nombres con espacios sobrantes" || fail "se acepto un nombre con espacios sobrantes"
rejected "$DB" "INSERT INTO roles (id, organization_id, name, updated_at) VALUES ('r-long', '$ORG_A', '$(printf 'x%.0s' $(seq 1 61))', now())" \
  && pass "CHECK roles_name_length_check rechaza nombres de mas de 60 caracteres" || fail "se acepto un nombre de 61 caracteres"
rejected "$DB" "INSERT INTO roles (id, organization_id, key, name, updated_at) VALUES ('r-dupkey', '$ORG_A', 'CAMPO', 'Otro Campo', now())" \
  && pass "la key de un rol de sistema es unica por organizacion" || fail "se acepto una key duplicada en la organizacion"

rejected "$DB" "INSERT INTO user_company_assignments (id, organization_id, firebase_uid, company_id, branch_id, role_id) VALUES ('asg-x', '$ORG_A', 'uid-x', '$CO_A', '$BR_A', '$ROLE_B_FO')" \
  && pass "FK compuesta: una asignacion no puede usar un rol de OTRA organizacion" || fail "se acepto una asignacion con rol de otra organizacion"
q "$DB" "INSERT INTO user_company_assignments (id, organization_id, firebase_uid, company_id, branch_id, role_id) VALUES ('asg-ok', '$ORG_A', 'uid-ok', '$CO_A', '$BR_A', '$ROLE_A_FO')" >/dev/null 2>&1 \
  && pass "una asignacion nueva sin la columna enum deprecada (role NULL) se acepta" || fail "se rechazo una asignacion valida solo con role_id"

rejected "$DB" "INSERT INTO role_permission_matrix_versions (id, organization_id, version, role_id, action, allowed, created_by) VALUES ('mx-x1', '$ORG_A', 9, '$ROLE_B_FO', 'RESERVATION.CREATE', true, 'u')" \
  && pass "FK compuesta: una celda de matriz no puede usar un rol de OTRA organizacion" || fail "se acepto una celda con rol de otra organizacion"
rejected "$DB" "INSERT INTO role_permission_matrix_versions (id, organization_id, version, role_id, action, allowed, created_by) VALUES ('mx-x2', '$ORG_A', 1, '$ROLE_A_FO', 'RESERVATION.CREATE', false, 'u')" \
  && pass "UNIQUE (organizacion, version, role_id, accion) rechaza una celda repetida" || fail "se acepto una celda duplicada"
rejected "$DB" "INSERT INTO role_permission_matrix_versions (id, organization_id, version, role_id, branch_id, action, allowed, created_by) VALUES ('mx-x3', '$ORG_A', 9, '$ROLE_A_FO', '$BR_A', 'RESERVATION.CREATE', true, 'u')" \
  && pass "CHECK de ambito: una sede sin empresa se rechaza" || fail "se acepto un ambito con sede y sin empresa"
rejected "$DB" "INSERT INTO role_permission_matrix_versions (id, organization_id, version, role_id, company_id, action, allowed, created_by) VALUES ('mx-x4', '$ORG_A', 9, '$ROLE_A_FO', '$CO_B', 'RESERVATION.CREATE', true, 'u')" \
  && pass "FK compuesta: el ambito (empresa) debe ser de la misma organizacion" || fail "se acepto una empresa de otra organizacion como ambito"
q "$DB" "INSERT INTO role_permission_matrix_versions (id, organization_id, version, role_id, company_id, branch_id, action, allowed, created_by) VALUES ('mx-ok', '$ORG_A', 9, '$ROLE_A_FO', '$CO_A', '$BR_A', 'RESERVATION.CREATE', true, 'u')" >/dev/null 2>&1 \
  && pass "una version con ambito de sede valido se acepta" || fail "se rechazo un ambito de sede valido"

rejected "$DB" "DELETE FROM roles WHERE id = '$ROLE_A_FO'" \
  && pass "onDelete Restrict: un rol en uso no se puede borrar (se desactiva)" || fail "se borro un rol referenciado"
rejected "$DB" "UPDATE roles SET version = 0 WHERE id = '$ROLE_A_FO'" \
  && pass "CHECK roles_version_positive_check" || fail "se acepto version 0"
drop_db "$DB"

echo "Caso 3: base vacia"
DB=$(new_db empty)
apply_before_target "$DB"
if out=$(apply_target "$DB"); then
  n=$(q "$DB" "SELECT count(*) FROM roles")
  [[ "$n" == "0" ]] && pass "aplica sobre una base sin datos y no siembra roles (los crea ensureSystemRoles al dar de alta la organizacion)" || fail "roles inesperados en base vacia: $n"
else
  fail "la migracion fallo sobre una base vacia: $out"
fi
drop_db "$DB"

if [[ $FAILS -gt 0 ]]; then echo "RESULTADO: $FAILS caso(s) fallidos"; exit 1; fi
echo "RESULTADO: todos los casos pasaron"
