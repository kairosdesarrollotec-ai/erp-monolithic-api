-- RES PEND-07 / NFR-KAI-001 (TDD-RES-001 9.2/10.1): exclusion de rango en BD para vehicle_commitments.
-- Un vehiculo no puede tener dos compromisos bloqueantes (ACTIVE|CONSOLIDATED) con periodos [starts_at, ends_at) solapados.
-- Es la ultima linea de defensa de la doble confirmacion; la comprobacion en transaccion Serializable (findFirstVehicleConflict)
-- se mantiene como primera linea para devolver el 409 VEHICLE_NOT_AVAILABLE con las fechas ocupadas.
-- Escrita A MANO (no se representa en schema.prisma, igual que vacation_requests_area_no_overlap_excl).
--
-- SEGURIDAD CON DATOS EXISTENTES: si ya hay compromisos bloqueantes solapados, la migracion DEBE fallar. Marcarla como aplicada sin
-- crear la constraint dejaría la regla NFR-KAI-001 sin la defensa de base de datos y permitiría una doble asignacion futura. Saneamiento
-- y reintento: docs/runbooks/vehicle-commitment-overlap-remediation.md.
CREATE EXTENSION IF NOT EXISTS btree_gist;

DO $$
DECLARE
  overlap_count integer;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vehicle_commitments_no_overlap_excl'
  ) THEN
    RAISE NOTICE 'vehicle_commitments_no_overlap_excl ya existe; no se hace nada.';
    RETURN;
  END IF;

  SELECT count(*) INTO overlap_count
  FROM "vehicle_commitments" a
  JOIN "vehicle_commitments" b
    ON a."vehicle_id" = b."vehicle_id"
   AND a."id" < b."id"
   AND a."status" IN ('ACTIVE', 'CONSOLIDATED')
   AND b."status" IN ('ACTIVE', 'CONSOLIDATED')
   AND a."starts_at" < a."ends_at"
   AND b."starts_at" < b."ends_at"
   AND tsrange(a."starts_at", a."ends_at", '[)') && tsrange(b."starts_at", b."ends_at", '[)');

  IF overlap_count > 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'integrity_constraint_violation',
      MESSAGE = format(
        'vehicle_commitments: %s par(es) de compromisos bloqueantes solapados; se aborta la migracion para no omitir vehicle_commitments_no_overlap_excl.',
        overlap_count
      ),
      HINT = 'Sanee los solapamientos segun docs/runbooks/vehicle-commitment-overlap-remediation.md y vuelva a ejecutar prisma migrate deploy.';
  ELSE
    ALTER TABLE "vehicle_commitments"
      ADD CONSTRAINT "vehicle_commitments_no_overlap_excl"
      EXCLUDE USING gist (
        "vehicle_id" WITH =,
        tsrange("starts_at", "ends_at", '[)') WITH &&
      )
      WHERE ("status" IN ('ACTIVE', 'CONSOLIDATED') AND "starts_at" < "ends_at");
  END IF;
END
$$;
