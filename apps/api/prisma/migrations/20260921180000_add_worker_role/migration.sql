-- Hallazgo medio de revision PR#5: agrega el rol PROVISIONAL de
-- HU-24/TR-06 (WorkerRole) como migracion incremental, sin tocar la
-- migracion 20260918000000_init ya aplicada (PR#4). El modelo definitivo
-- de roles y permisos vive en ADM-02, todavia no construido.

-- CreateEnum
CREATE TYPE "WorkerRole" AS ENUM ('ADMINISTRACION', 'AUDITORIA', 'CAMPO', 'FINANZAS', 'FRONT_OFFICE', 'GERENCIA', 'RRHH');

-- AlterTable
ALTER TABLE "user_company_assignments" ADD COLUMN "role" "WorkerRole" NOT NULL;
