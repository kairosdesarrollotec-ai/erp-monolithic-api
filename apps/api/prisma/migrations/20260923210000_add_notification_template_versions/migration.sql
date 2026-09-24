-- ADM-05 (PANTALLAS-V2-B-SOPORTE.md) - plantillas de notificacion
-- versionadas. Ver el modelo NotificationTemplateVersion en
-- schema.prisma para el detalle completo, incluida la nota de alcance
-- real (configura texto/canal, no envia nada todavia - TR-07 sigue
-- pendiente).
--
-- Generada y revisada a mano, misma limitacion de red que las
-- migraciones anteriores de esta sesion (sin salida hacia
-- binaries.prisma.sh en este entorno sandbox, ver
-- docs/decision-log.md PROP-003/NOTA-PROP-003): correr en un entorno
-- con red completa antes de mergear:
--   npx prisma generate
--   npx prisma migrate dev
-- para que Prisma re-valide/re-genere esta migracion oficialmente.

-- CreateTable
CREATE TABLE "notification_template_versions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "channels" TEXT[],
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,

    CONSTRAINT "notification_template_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notification_template_versions_organization_id_event_type__key" ON "notification_template_versions"("organization_id", "event_type", "version");
