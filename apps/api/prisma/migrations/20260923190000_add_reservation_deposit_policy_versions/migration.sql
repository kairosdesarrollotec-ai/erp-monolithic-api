-- ADM-03 (PANTALLAS-V2-B-SOPORTE.md) - primera version real de un
-- parametro versionado: reemplaza el valor fijo en codigo documentado
-- en reservation-deposit-policy.ts (BR-RES-001, docs/decision-log.md
-- PROP-005). Ver el modelo ReservationDepositPolicyVersion en
-- schema.prisma para el detalle completo.
--
-- Generada y revisada a mano, mismo criterio y misma limitacion de red
-- que 20260923120000_add_dashboard_items (sin salida hacia
-- binaries.prisma.sh en este entorno sandbox, ver docs/decision-log.md
-- PROP-003/NOTA-PROP-003): correr en un entorno con red completa antes
-- de mergear:
--   npx prisma generate
--   npx prisma migrate dev
-- para que Prisma re-valide/re-genere esta migracion oficialmente.

-- CreateTable
CREATE TABLE "reservation_deposit_policy_versions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "effective_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,

    CONSTRAINT "reservation_deposit_policy_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- "Solo una version vigente a la vez" (contrato ADM-03 punto 8): nunca
-- 2 filas con el mismo numero de version para la misma organizacion.
CREATE UNIQUE INDEX "reservation_deposit_policy_versions_organization_id_versio_key" ON "reservation_deposit_policy_versions"("organization_id", "version");
