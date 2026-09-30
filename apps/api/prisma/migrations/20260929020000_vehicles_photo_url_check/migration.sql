-- Migration: vehicles_photo_url_check
-- Nullify any existing data: URIs (legacy from canvas compression in NewVehicleModal)
-- and add a CHECK constraint that prevents future data: URIs from being stored.
-- Safe for empty tables and for tables that already contain valid GCS URLs.

UPDATE "vehicles"
SET "photo_url" = NULL
WHERE "photo_url" LIKE 'data:%';

ALTER TABLE "vehicles"
  ADD CONSTRAINT "vehicles_photo_url_no_data_uri"
  CHECK ("photo_url" IS NULL OR "photo_url" NOT LIKE 'data:%');
