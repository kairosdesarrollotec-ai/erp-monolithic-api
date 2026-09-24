#!/usr/bin/env bash
# Prueba de UPGRADE de la migracion 20260923000000_inquiries_expand_backfill_contract
# sobre PostgreSQL REAL con datos poblados (hallazgo CRITICO de revalidacion
# PR#7: "migracion incremental con backfill validado y prueba de upgrade sobre
# PostgreSQL poblado").
#
# Requiere solo `psql` y un PostgreSQL accesible. Usa las variables estandar
# de libpq (PGHOST, PGPORT, PGUSER, PGPASSWORD). Crea y destruye sus propias
# bases temporales - nunca toca la base de desarrollo.
#
#   PGHOST=localhost PGPORT=5434 PGUSER=kairos PGPASSWORD=... \
#     bash apps/api/test/migrations/inquiries-upgrade.test.sh
#
# Casos:
#   1. Upgrade feliz: base con stubs de PR#6 + reservas -> backfill verificable.
#   2. Invariantes post-migracion: CHECK de snapshot CON-02, UNIQUE
#      reservations.inquiry_id (incluida una carrera real entre 2 sesiones).
#   3. Stub sin reserva -> la migracion ABORTA con mensaje y no deja cambios.
#   4. Consulta con 2 reservas -> la migracion ABORTA con mensaje.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
MIGRATIONS="$HERE/../../prisma/migrations"
TARGET="20260923000000_inquiries_expand_backfill_contract"
PSQL=(psql -X -q -v ON_ERROR_STOP=1 -At)
FAILS=0
RUN_ID="$$"

pass() { echo "  PASS - $1"; }
fail() { echo "  FAIL - $1"; FAILS=$((FAILS + 1)); }

new_db() {
  local db="kairos_upgrade_${RUN_ID}_$1"
  "${PSQL[@]}" -d postgres -c "SET client_min_messages = warning" -c "DROP DATABASE IF EXISTS $db" -c "CREATE DATABASE $db" >/dev/null
  echo "$db"
}

drop_db() { "${PSQL[@]}" -d postgres -c "DROP DATABASE IF EXISTS $1" >/dev/null; }

# Aplica todas las migraciones ANTERIORES a TARGET (estado de PR#6), cada una
# en una transaccion (igual que `prisma migrate deploy` en PostgreSQL).
apply_before_target() {
  local db="$1"
  for dir in $(ls -d "$MIGRATIONS"/2026*/ | sort); do
    [[ "$(basename "$dir")" == "$TARGET" ]] && break
    "${PSQL[@]}" -1 -d "$db" -f "$dir/migration.sql" >/dev/null 2>&1
  done
}

apply_target() { "${PSQL[@]}" -1 -d "$1" -f "$MIGRATIONS/$TARGET/migration.sql" 2>&1; }

q() { "${PSQL[@]}" -d "$1" -c "$2"; }

ORG=11111111-1111-1111-1111-111111111111
CO=22222222-2222-2222-2222-222222222222
BR1=33333333-3333-3333-3333-333333333331
BR2=33333333-3333-3333-3333-333333333332
CU=44444444-4444-4444-4444-444444444444
VE=55555555-5555-5555-5555-555555555555

seed_pr6_state() {
  local db="$1"
  q "$db" "
    INSERT INTO companies (id, organization_id, name, updated_at) VALUES ('$CO', '$ORG', 'VeloxRent', now());
    INSERT INTO branches (id, company_id, name, updated_at) VALUES ('$BR1', '$CO', 'Sede 1', now()), ('$BR2', '$CO', 'Sede 2', now());
    INSERT INTO customers (id, organization_id, operating_company_id, full_name, document_type, document_number)
      VALUES ('$CU', '$ORG', '$CO', 'Cliente Legado', 'DNI', '12345678');
    INSERT INTO vehicles (id, organization_id, operating_company_id, plate, brand, model)
      VALUES ('$VE', '$ORG', '$CO', 'ABC-123', 'Toyota', 'Hilux');
  " >/dev/null
}

# Stub de consulta de PR#6 + su reserva (como lo crea CreateReservationHandler).
seed_stub_with_reservation() {
  local db="$1" inquiry="$2" reservation="$3" branch="$4" actor="$5"
  q "$db" "
    INSERT INTO inquiries (id, organization_id, operating_company_id) VALUES ('$inquiry', '$ORG', '$CO');
    INSERT INTO reservations (id, organization_id, operating_company_id, branch_id, inquiry_id, customer_id, vehicle_id,
                              channel_mode, start_at, end_at, required_payment_amount, currency, payment_policy_version, created_by)
      VALUES ('$reservation', '$ORG', '$CO', '$branch', '$inquiry', '$CU', '$VE',
              'PRESENCIAL', now() + interval '1 day', now() + interval '3 day', 300, 'PEN', 1, '$actor');
  " >/dev/null
}

echo "Caso 1-2: upgrade feliz sobre base poblada + invariantes"
DB=$(new_db happy)
apply_before_target "$DB"
seed_pr6_state "$DB"
INQ1=66666666-6666-6666-6666-666666666661
INQ2=66666666-6666-6666-6666-666666666662
seed_stub_with_reservation "$DB" "$INQ1" 77777777-7777-7777-7777-777777777771 "$BR1" "uid-agente-1"
seed_stub_with_reservation "$DB" "$INQ2" 77777777-7777-7777-7777-777777777772 "$BR2" "uid-agente-2"

if out=$(apply_target "$DB"); then pass "la migracion aplica sobre una base con consultas pobladas"; else fail "la migracion fallo: $out"; fi

row=$(q "$DB" "SELECT branch_id, created_by, customer_id, tourist_use, status, data_origin, version, channel IS NULL, nationality IS NULL FROM inquiries WHERE id = '$INQ2'")
[[ "$row" == "$BR2|uid-agente-2|$CU|t|CONVERTIDA|LEGACY_STUB|1|t|t" ]] \
  && pass "backfill verificable desde la reserva (sede, responsable, cliente, CONVERTIDA, LEGACY_STUB); datos nunca capturados quedan NULL" \
  || fail "backfill inesperado: $row"

nn=$(q "$DB" "SELECT string_agg(column_name || '=' || is_nullable, ',' ORDER BY column_name) FROM information_schema.columns WHERE table_name = 'inquiries' AND column_name IN ('branch_id','created_by','tourist_use','status','data_origin','version')")
[[ "$nn" == "branch_id=NO,created_by=NO,data_origin=NO,status=NO,tourist_use=NO,version=NO" ]] \
  && pass "contract aplicado: columnas obligatorias quedan NOT NULL" || fail "nulabilidad inesperada: $nn"

if q "$DB" "INSERT INTO inquiries (id, organization_id, operating_company_id, branch_id, tourist_use, created_by, channel)
            VALUES (gen_random_uuid(), '$ORG', '$CO', '$BR1', true, 'uid', 'WHATSAPP')" >/dev/null 2>&1; then
  fail "una consulta CON02 sin snapshot (nacionalidad/destino/dias/cliente) fue aceptada"
else
  pass "CHECK inquiries_con02_snapshot_check rechaza una consulta nueva sin snapshot CON-02"
fi

NEW=88888888-8888-8888-8888-888888888888
if q "$DB" "INSERT INTO inquiries (id, organization_id, operating_company_id, branch_id, tourist_use, created_by, channel,
                                   nationality, destination, estimated_days, prospect_name, status)
            VALUES ('$NEW', '$ORG', '$CO', '$BR1', true, 'uid', 'WHATSAPP', 'EXTRANJERO', 'Vilcashuaman', 3, 'Ana Prospecto', 'COTIZADA')" >/dev/null 2>&1; then
  pass "una consulta CON02 con snapshot completo se acepta (default data_origin = CON02)"
else
  fail "una consulta CON02 valida fue rechazada"
fi

if q "$DB" "INSERT INTO reservations (id, organization_id, operating_company_id, branch_id, inquiry_id, customer_id, vehicle_id,
              channel_mode, start_at, end_at, required_payment_amount, currency, payment_policy_version, created_by)
            VALUES (gen_random_uuid(), '$ORG', '$CO', '$BR1', '$INQ1', '$CU', '$VE', 'PRESENCIAL',
                    now() + interval '5 day', now() + interval '6 day', 300, 'PEN', 1, 'uid')" >/dev/null 2>&1; then
  fail "se creo una SEGUNDA reserva para la misma consulta"
else
  pass "UNIQUE reservations.inquiry_id rechaza una segunda reserva para la misma consulta"
fi

# Carrera real: 2 sesiones concurrentes intentan crear la reserva de la misma consulta.
race_insert() {
  "${PSQL[@]}" -d "$DB" -c "BEGIN;
    INSERT INTO reservations (id, organization_id, operating_company_id, branch_id, inquiry_id, customer_id, vehicle_id,
      channel_mode, start_at, end_at, required_payment_amount, currency, payment_policy_version, created_by)
    VALUES (gen_random_uuid(), '$ORG', '$CO', '$BR1', '$NEW', '$CU', '$VE', 'PRESENCIAL',
            now() + interval '5 day', now() + interval '6 day', 300, 'PEN', 1, 'uid-$1');
    SELECT pg_sleep(1);
    COMMIT;" >/dev/null 2>&1 && echo ok > "$2" || echo rejected > "$2"
}
TMPD=$(mktemp -d)
race_insert a "$TMPD/a" & race_insert b "$TMPD/b" & wait
outcomes="$(cat "$TMPD/a") $(cat "$TMPD/b")"; rm -rf "$TMPD"
count=$(q "$DB" "SELECT count(*) FROM reservations WHERE inquiry_id = '$NEW'")
[[ "$count" == "1" && ( "$outcomes" == "ok rejected" || "$outcomes" == "rejected ok" ) ]] \
  && pass "carrera real entre 2 sesiones concurrentes: una confirma, la otra es rechazada por la base ($outcomes)" \
  || fail "carrera concurrente: $count reservas, resultados '$outcomes'"

CO2=22222222-2222-2222-2222-222222222229
VE2=55555555-5555-5555-5555-555555555559
q "$DB" "INSERT INTO companies (id, organization_id, name, updated_at) VALUES ('$CO2', '$ORG', 'Casa del Auto', now());
         INSERT INTO vehicles (id, organization_id, operating_company_id, plate, brand, model)
           VALUES ('$VE2', '$ORG', '$CO2', 'XYZ-999', 'Kia', 'Rio')" >/dev/null
if q "$DB" "INSERT INTO quotations (id, inquiry_id, operating_company_id, vehicle_id, rate_card_version_id, destination, estimated_days, amount, currency, valid_until)
            VALUES (gen_random_uuid(), '$NEW', '$CO', '$VE2', 'v1', 'x', 1, 10, 'PEN', now())" >/dev/null 2>&1; then
  fail "se acepto cotizar un vehiculo de OTRA empresa de la misma organizacion"
else
  pass "FK compuesta de quotations rechaza cotizar un vehiculo de otra empresa (misma organizacion)"
fi
if q "$DB" "INSERT INTO quotations (id, inquiry_id, operating_company_id, vehicle_id, rate_card_version_id, destination, estimated_days, amount, currency, valid_until)
            VALUES (gen_random_uuid(), '$NEW', '$CO', '$VE', 'v1', 'x', 1, 10, 'PEN', now())" >/dev/null 2>&1; then
  pass "control: cotizar un vehiculo de la misma empresa se acepta"
else
  fail "control: una cotizacion valida fue rechazada"
fi
drop_db "$DB"

echo "Caso 3: stub sin reserva -> aborta sin cambios"
DB=$(new_db orphan)
apply_before_target "$DB"
seed_pr6_state "$DB"
q "$DB" "INSERT INTO inquiries (id, organization_id, operating_company_id) VALUES (gen_random_uuid(), '$ORG', '$CO')" >/dev/null
if out=$(apply_target "$DB"); then
  fail "la migracion no aborto con un stub huerfano"
else
  [[ "$out" == *"sin reserva asociada"* ]] && pass "aborta con mensaje accionable: stub sin reserva" || fail "mensaje inesperado: $out"
fi
cols=$(q "$DB" "SELECT count(*) FROM information_schema.columns WHERE table_name = 'inquiries' AND column_name = 'branch_id'")
[[ "$cols" == "0" ]] && pass "tras abortar, la base queda intacta (transaccion revertida)" || fail "quedaron cambios parciales"
drop_db "$DB"

echo "Caso 4: consulta con 2 reservas -> aborta"
DB=$(new_db dup)
apply_before_target "$DB"
seed_pr6_state "$DB"
seed_stub_with_reservation "$DB" "$INQ1" 77777777-7777-7777-7777-777777777771 "$BR1" "uid"
q "$DB" "INSERT INTO reservations (id, organization_id, operating_company_id, branch_id, inquiry_id, customer_id, vehicle_id,
           channel_mode, start_at, end_at, required_payment_amount, currency, payment_policy_version, created_by)
         VALUES (gen_random_uuid(), '$ORG', '$CO', '$BR1', '$INQ1', '$CU', '$VE', 'PRESENCIAL',
                 now() + interval '9 day', now() + interval '10 day', 300, 'PEN', 1, 'uid')" >/dev/null
if out=$(apply_target "$DB"); then
  fail "la migracion no aborto con una consulta de 2 reservas"
else
  [[ "$out" == *"mas de una reserva"* ]] && pass "aborta con mensaje accionable: consulta con 2 reservas" || fail "mensaje inesperado: $out"
fi
drop_db "$DB"

if [[ $FAILS -gt 0 ]]; then echo "RESULTADO: $FAILS caso(s) fallidos"; exit 1; fi
echo "RESULTADO: todos los casos pasaron"
