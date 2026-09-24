-- Hallazgo CRITICO de revision de seguimiento de PR#4 (revalidacion de
-- 9e33c4f, comentario "organizationId aun puede contradecir a
-- companyId"): sin esta migracion, la base permitia guardar una
-- user_company_assignments con organization_id A apuntando a una
-- companies de organization_id B, y
-- work-context-authorization.service.ts propagaba ese organization_id
-- incorrecto a reservas/consultas (mismo patron de riesgo que el
-- hallazgo critico ya corregido de branch/company en la migracion
-- inicial, pero un nivel mas arriba: company/organization).
--
-- Estrategia identica a la ya usada para branches -> companies
-- (@@unique([id, companyId]) en Branch + FK compuesta en
-- UserCompanyAssignment.branch): se agrega una unique compuesta en
-- companies(id, organization_id) y se reemplaza la FK simple de
-- user_company_assignments.company_id por una FK compuesta
-- (company_id, organization_id) -> companies(id, organization_id).
-- Insertar una asignacion cuyo organization_id no coincida con el de la
-- empresa referenciada ahora es un error de integridad referencial a
-- nivel de base de datos, no solo una validacion de aplicacion.

-- CreateIndex (soporte de la FK compuesta de abajo)
CREATE UNIQUE INDEX "companies_id_organization_id_key" ON "companies"("id", "organization_id");

-- DropForeignKey (FK simple insuficiente que esta migracion reemplaza)
ALTER TABLE "user_company_assignments" DROP CONSTRAINT "user_company_assignments_company_id_fkey";

-- AddForeignKey (FK compuesta company_id+organization_id)
ALTER TABLE "user_company_assignments" ADD CONSTRAINT "user_company_assignments_company_id_organization_id_fkey" FOREIGN KEY ("company_id", "organization_id") REFERENCES "companies"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
