-- H-02 (19 oct 2026) / DEC-ADP-AREAS-001..003: catalogo de areas de RR.HH. por empresa. Escrita A MANO (nunca `migrate dev`),
-- ADITIVA: 1 tabla nueva + backfill de textos libres existentes de employees.area_* a las areas del catalogo cuando coinciden
-- EXACTAMENTE (sin distinguir mayusculas ni tildes). Lo que no coincide queda como texto libre, sin cambios. Indices <= 63 caracteres.
--
-- ROLLBACK NOTE: ver rollback.sql (DROP TABLE "hr_areas"). El backfill NO se revierte: sustituyo el texto por el nombre oficial
-- del area (mismo area, distinta escritura) y el codigo es el mismo que ya derivaba el front (areaIdFromName).

-- CreateTable
CREATE TABLE "hr_areas" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "operating_company_id" TEXT NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(255),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hr_areas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "hr_areas_company_code_key" ON "hr_areas"("operating_company_id", "code");

-- CreateIndex
CREATE INDEX "hr_areas_scope_active_idx" ON "hr_areas"("organization_id", "operating_company_id", "is_active");

-- AddForeignKey
ALTER TABLE "hr_areas" ADD CONSTRAINT "hr_areas_operating_company_id_organization_id_fkey" FOREIGN KEY ("operating_company_id", "organization_id") REFERENCES "companies"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Semilla: SOLO las areas DOCUMENTADAS de VeloxRent S.A.C. (Inventario_Procesos_VELOXRENT, organigrama oficial recibido el
-- 17 ago; Ficha AS-IS Reclutamiento 2.1, confirmado el 12 ago). Se siembra en toda empresa cuyo nombre contenga "veloxrent".
-- No se siembra Contabilidad (externa), Gerencia, ni las areas de Casa del Automovil/Motrix (ver Catalogo_Areas_RRHH_2026-10-19).
INSERT INTO "hr_areas" ("id", "organization_id", "operating_company_id", "code", "name", "description", "sort_order")
SELECT gen_random_uuid()::text, c."organization_id", c."id", a."code", a."name", a."description", a."sort_order"
FROM "companies" c
CROSS JOIN (VALUES
    ('ADMINISTRACION', 'Administración', 'Órgano de apoyo: gestión administrativa de la empresa', 10),
    ('TALENTO_HUMANO', 'Talento Humano', 'Órgano de apoyo: nombre formal de Recursos Humanos', 20),
    ('SERVICIOS_GENERALES', 'Servicios Generales', 'Órgano de apoyo: limpieza y áreas afines', 30),
    ('DESARROLLO_DE_TECNOLOGIA', 'Desarrollo de Tecnología', 'Órgano de apoyo: antes «Tecnología VeloxRent»; aquí encaja el proyecto Kairos', 40),
    ('ATENCION_AL_CLIENTE', 'Atención al cliente', 'Órgano de línea', 50),
    ('MARKETING', 'Marketing', 'Órgano de línea', 60),
    ('OPERACIONES', 'Operaciones', 'Órgano de línea', 70)
) AS a("code", "name", "description", "sort_order")
WHERE lower(c."name") LIKE '%veloxrent%'
ON CONFLICT ("operating_company_id", "code") DO NOTHING;

-- Backfill (empleados): texto libre que coincide EXACTAMENTE (mayusculas/tildes normalizadas) con el nombre de un area del
-- catalogo de SU empresa pasa a usar el codigo y el nombre oficiales. El resto queda intacto (texto libre).
CREATE FUNCTION pg_temp.hr_area_norm(txt TEXT) RETURNS TEXT AS $$
    SELECT btrim(regexp_replace(upper(translate(txt,
        'ÁÉÍÓÚÜÑáéíóúüñÀÈÌÒÙàèìòù', 'AEIOUUNAEIOUUNAEIOUAEIOU')), '[^A-Z0-9]+', ' ', 'g'))
$$ LANGUAGE sql IMMUTABLE;

CREATE TEMP TABLE hr_area_backfill AS
SELECT e."id" AS employee_id, e."area_id" AS old_area_id, a."code" AS new_code, a."name" AS new_name
FROM "employees" e
JOIN "hr_areas" a ON a."operating_company_id" = e."operating_company_id"
 AND pg_temp.hr_area_norm(a."name") = pg_temp.hr_area_norm(e."area_name")
WHERE e."area_id" <> a."code" OR e."area_name" <> a."name";

UPDATE "employees" e
SET "area_id" = b.new_code, "area_name" = b.new_name
FROM hr_area_backfill b
WHERE e."id" = b.employee_id;

-- Backfill (vacaciones): las solicitudes de esas personas se alinean al codigo del catalogo para que el cupo BR-ADP-002 no se
-- parta por la escritura. Fila a fila: si unificar el area produjera un solape (constraint de exclusion), esa fila queda como
-- estaba y se avisa con NOTICE (nunca se rompe la migracion).
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN
        SELECT v."id" AS vacation_id, b.new_code
        FROM "vacation_requests" v
        JOIN hr_area_backfill b ON b.employee_id = v."employee_id"
        WHERE v."area_id" <> b.new_code
    LOOP
        BEGIN
            UPDATE "vacation_requests" SET "area_id" = r.new_code WHERE "id" = r.vacation_id;
        EXCEPTION WHEN exclusion_violation THEN
            RAISE NOTICE 'hr_areas_catalog: vacation_request % conserva su area_id (solape al unificar con %)', r.vacation_id, r.new_code;
        END;
    END LOOP;
END $$;

DROP TABLE hr_area_backfill;
DROP FUNCTION pg_temp.hr_area_norm(TEXT);
