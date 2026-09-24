-- ADM-02 (PANTALLAS-V2-B-SOPORTE.md) - primera version real de una
-- matriz de permisos rol-accion versionada. Ver el modelo
-- RolePermissionMatrixVersion en schema.prisma para el detalle
-- completo, incluida la nota de alcance real (todavia no reemplaza el
-- enforcement en los *-role-policy.ts existentes).
--
-- Generada y revisada a mano, mismo criterio y misma limitacion de red
-- que 20260923190000_add_reservation_deposit_policy_versions (sin
-- salida hacia binaries.prisma.sh en este entorno sandbox, ver
-- docs/decision-log.md PROP-003/NOTA-PROP-003): correr en un entorno
-- con red completa antes de mergear:
--   npx prisma generate
--   npx prisma migrate dev
-- para que Prisma re-valide/re-genere esta migracion oficialmente.

-- CreateTable
CREATE TABLE "role_permission_matrix_versions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "role" "WorkerRole" NOT NULL,
    "action" TEXT NOT NULL,
    "allowed" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,

    CONSTRAINT "role_permission_matrix_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "role_permission_matrix_versions_organization_id_version_ro_key" ON "role_permission_matrix_versions"("organization_id", "version", "role", "action");
