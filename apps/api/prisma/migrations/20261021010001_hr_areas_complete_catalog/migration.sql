-- Respuestas 2026-10-20 #17: se completa el catalogo de areas de RR.HH. con Gerencia General / Subgerencia y Gestion y Procesos.
-- Escrita A MANO (nunca `migrate dev`), ADITIVA e idempotente: solo inserta lo que falta en las empresas "veloxrent" ya sembradas.
-- NO se siembra Contabilidad externa. Las empresas nuevas se siembran desde el alta de empresa (ensureHrAreasForCompany).
INSERT INTO "hr_areas" ("id", "organization_id", "operating_company_id", "code", "name", "description", "sort_order")
SELECT gen_random_uuid()::text, c."organization_id", c."id", a."code", a."name", a."description", a."sort_order"
FROM "companies" c
CROSS JOIN (VALUES
    ('GERENCIA_GENERAL', 'Gerencia General / Subgerencia', 'Dirección de la empresa (Gerencia General y Subgerencia)', 80),
    ('GESTION_Y_PROCESOS', 'Gestión y Procesos', 'Gestión de procesos de la empresa', 90)
) AS a("code", "name", "description", "sort_order")
WHERE lower(c."name") LIKE '%veloxrent%'
ON CONFLICT ("operating_company_id", "code") DO NOTHING;
