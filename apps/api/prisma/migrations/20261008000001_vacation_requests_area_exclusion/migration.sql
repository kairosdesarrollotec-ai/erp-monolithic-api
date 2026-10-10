-- BR-ADP-002: máximo 1 persona por área con vacaciones PROGRAMADAS en fechas solapadas.
-- EXCLUDE USING gist requiere btree_gist para el operador = sobre TEXT.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Constraint de exclusión: impide aprobar vacaciones solapadas en la misma área.
-- Aplica solo a estados PROGRAMADA y REPROGRAMADA (vacaciones activas/aprobadas).
-- daterange start_date..end_date con inclusión de ambos extremos ([]).
ALTER TABLE "vacation_requests"
ADD CONSTRAINT "vacation_requests_area_no_overlap_excl"
EXCLUDE USING gist (
    "area_id" WITH =,
    daterange("start_date", "end_date", '[]') WITH &&
)
WHERE ("status" IN ('PROGRAMADA', 'REPROGRAMADA'));
