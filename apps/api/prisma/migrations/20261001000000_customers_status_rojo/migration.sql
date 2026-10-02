-- AlterTable
-- BR-ALQ-013: estado "rojo"/lista negra del cliente. NORMAL | ROJO.
ALTER TABLE "customers"
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'NORMAL';
