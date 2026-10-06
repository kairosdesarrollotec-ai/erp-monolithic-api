-- Rollback: 20261005000000_add_returns_module
-- Elimina todas las tablas, índices, restricciones y tipos creados por esta migración.
-- ORDEN: tablas dependientes primero (FK CASCADE cubre las filas, pero los objetos deben eliminarse en orden).

-- Índices (se eliminan con las tablas, pero los listamos para trazabilidad)
-- DROP INDEX IF EXISTS "return_evidence_organization_id_operating_company_id_retu_idx";
-- DROP INDEX IF EXISTS "return_evidence_return_id_type_idx";
-- DROP INDEX IF EXISTS "immobilization_charges_return_id_idx";
-- DROP INDEX IF EXISTS "return_damages_return_id_idx";
-- DROP INDEX IF EXISTS "returns_rental_id_idx";
-- DROP INDEX IF EXISTS "returns_organization_id_operating_company_id_branch_id_sta_idx";
-- DROP INDEX IF EXISTS "returns_operating_company_id_status_created_at_idx";

-- Tablas (orden: dependientes → padre)
DROP TABLE IF EXISTS "return_evidence";
DROP TABLE IF EXISTS "immobilization_charges";
DROP TABLE IF EXISTS "return_damages";
DROP TABLE IF EXISTS "returns";

-- Tipos ENUM creados por esta migración
-- Solo eliminar si no hay otras tablas que los referencien.
DROP TYPE IF EXISTS "ReturnEvidenceType";
DROP TYPE IF EXISTS "ReturnFuelLevel";
DROP TYPE IF EXISTS "DamageSeverity";
DROP TYPE IF EXISTS "DamageOrigin";
DROP TYPE IF EXISTS "CustodyHolder";
DROP TYPE IF EXISTS "ReturnStatus";
