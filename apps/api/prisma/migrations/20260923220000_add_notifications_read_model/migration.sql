-- TR-07 (PANTALLAS-V2-B-TRANSVERSAL.md) - proyeccion de lectura de
-- notificaciones. Ver el modelo NotificationReadModel en schema.prisma
-- para el detalle completo, incluida la nota de alcance real
-- (destinatario = actor del evento, isEscalated siempre false por
-- ahora).
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
CREATE TABLE "notifications_read_model" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "recipient_firebase_uid" TEXT NOT NULL,
    "notification_type" TEXT NOT NULL,
    "is_escalated" BOOLEAN NOT NULL DEFAULT false,
    "title" TEXT NOT NULL,
    "deep_link" TEXT NOT NULL,
    "read_at" TIMESTAMP(3),
    "source_event_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_read_model_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notifications_read_model_source_event_id_key" ON "notifications_read_model"("source_event_id");

-- CreateIndex
CREATE INDEX "notifications_read_model_recipient_firebase_uid_read_at_c_idx" ON "notifications_read_model"("recipient_firebase_uid", "read_at", "created_at");
