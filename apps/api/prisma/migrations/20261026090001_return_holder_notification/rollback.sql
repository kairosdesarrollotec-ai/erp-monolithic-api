ALTER TABLE "returns"
  DROP COLUMN IF EXISTS "holder_notification_notes",
  DROP COLUMN IF EXISTS "holder_notification_channel",
  DROP COLUMN IF EXISTS "holder_notification_sent_by",
  DROP COLUMN IF EXISTS "holder_notification_sent_at",
  DROP COLUMN IF EXISTS "holder_notification_sent";
