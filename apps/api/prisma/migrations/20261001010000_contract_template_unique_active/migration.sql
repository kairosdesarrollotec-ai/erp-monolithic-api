-- TDD-ALQ-001.md seccion 9.3 / BR-DOC-002: solo puede existir una plantilla
-- de contrato ACTIVA por empresa+tipo a la vez (contract_template_unique_active).
-- El unique index "contract_templates_company_id_type_version_key" (creado en
-- 20260930000000_add_rentals_module) ya impide repetir una (company_id, type,
-- version), pero no impide tener 2 versiones distintas ambas en estado ACTIVE
-- simultaneamente. Se agrega un indice unico parcial (solo sobre filas
-- status = 'ACTIVE') para cerrar ese hueco a nivel de base de datos - Prisma
-- schema.prisma no puede expresar un indice parcial (`WHERE`), por eso vive
-- solo en esta migracion.
CREATE UNIQUE INDEX "contract_template_unique_active" ON "contract_templates"("company_id", "type") WHERE "status" = 'ACTIVE';
