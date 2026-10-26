-- B3: SC-DEV-004.01, EX-DEV-001 - Notificación formal al titular ausente al día siguiente
ALTER TABLE "returns"
  ADD COLUMN "holder_notification_sent" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "holder_notification_sent_at" TIMESTAMPTZ,
  ADD COLUMN "holder_notification_sent_by" TEXT,
  ADD COLUMN "holder_notification_channel" TEXT,
  ADD COLUMN "holder_notification_notes" TEXT;
