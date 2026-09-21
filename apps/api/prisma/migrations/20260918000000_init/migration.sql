-- KAIROS/VeloxRent ERP - migracion inicial versionada
--
-- Hallazgo de revision PR#4 ("Faltan migraciones"): hasta este cambio el
-- schema de Prisma se aplicaba con `prisma db push`, sin SQL versionado,
-- sin historial reproducible y sin posibilidad de rollback. Esta es la
-- primera migracion real del proyecto - captura el estado completo del
-- schema (incluye los hallazgos criticos corregidos en este mismo PR:
-- integridad empresa/sede y vigencia de asignaciones, mas el rol
-- PROVISIONAL de HU-24/TR-06 incorporado al rebasar PR#5 sobre esta base).
--
-- Generada y probada a mano contra un Postgres 16 real (no `prisma migrate
-- dev`): el sandbox de desarrollo donde se escribio originalmente no
-- tiene salida de red hacia binaries.prisma.sh (motor de Prisma), asi
-- que `prisma generate`/`prisma migrate dev` no se podian ejecutar ahi.
--
-- ACTUALIZACION (hallazgo ALTO de revision de seguimiento de PR#4,
-- revalidacion de 9e33c4f): esta nota quedo desactualizada y
-- contradecia la respuesta del autor en esa misma revision - el CI
-- (.github/workflows/ci.yml) SI corre `npx prisma generate` en un
-- entorno con red completa antes de build/test, asi que el cliente
-- Prisma usado en la aplicacion y en los tests es el tipado real
-- (`PrismaClient` generado), nunca el stub `any` que describia esta
-- nota. Las migraciones posteriores a esta (ver 20260921191500 y
-- 20260921201500) se corrigieron precisamente comparando contra
-- `prisma migrate diff` corrido en un entorno con esa red, y el
-- procedimiento de baseline para una base ya existente (creada antes
-- con `db push`, como advertia el hallazgo ALTO original) esta
-- documentado en docs/migraciones-baseline.md.

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "response_body" JSONB,
    "status_code" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" TEXT NOT NULL,
    "aggregate_type" TEXT NOT NULL,
    "aggregate_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "changes" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_commitments" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicle_commitments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profiles" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "firebase_uid" TEXT NOT NULL,
    "requires_password_change" BOOLEAN NOT NULL DEFAULT true,
    "mfa_enrolled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branches" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateEnum
-- PROVISIONAL (HU-24/TR-06): modelo minimo de rol para poder enrutar al
-- tablero correcto por rol. El modelo definitivo de roles y permisos
-- (matriz rol-accion-empresa-sede versionada) vive en ADM-02 (Roles y
-- permisos, PANTALLAS-V2-B-SOPORTE.md), todavia no construido.
CREATE TYPE "WorkerRole" AS ENUM ('ADMINISTRACION', 'AUDITORIA', 'CAMPO', 'FINANZAS', 'FRONT_OFFICE', 'GERENCIA', 'RRHH');

-- CreateTable
-- Hallazgo critico PR#4 ("la base permite asociar una sede con una empresa
-- diferente"): se agregan active/valid_from/valid_until (hallazgo alto
-- "asignaciones vigentes sin vigencia") ademas de la FK compuesta hacia
-- branches (ver abajo) que impide, a nivel de base de datos, que
-- company_id no coincida con la empresa real de la sede. "role"
-- (PROVISIONAL, ver CreateEnum arriba) es el rol de HU-24/TR-06.
CREATE TABLE "user_company_assignments" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "firebase_uid" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "role" "WorkerRole" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "valid_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_company_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_keys_key_key" ON "idempotency_keys"("key");

-- CreateIndex
CREATE INDEX "outbox_events_processed_at_idx" ON "outbox_events"("processed_at");

-- CreateIndex
CREATE INDEX "audit_events_organization_id_entity_type_entity_id_idx" ON "audit_events"("organization_id", "entity_type", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_commitments_source_type_source_id_key" ON "vehicle_commitments"("source_type", "source_id");

-- CreateIndex
CREATE INDEX "vehicle_commitments_vehicle_id_status_idx" ON "vehicle_commitments"("vehicle_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_firebase_uid_key" ON "user_profiles"("firebase_uid");

-- CreateIndex
CREATE INDEX "branches_company_id_idx" ON "branches"("company_id");

-- CreateIndex
-- Soporte de la FK compuesta hacia user_company_assignments (ver abajo):
-- exige que (id, company_id) sea unico, lo que permite referenciar la
-- pareja completa y no solo el id de la sede.
CREATE UNIQUE INDEX "branches_id_company_id_key" ON "branches"("id", "company_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_company_assignments_firebase_uid_company_id_branch_i_key" ON "user_company_assignments"("firebase_uid", "company_id", "branch_id");

-- CreateIndex
CREATE INDEX "user_company_assignments_firebase_uid_idx" ON "user_company_assignments"("firebase_uid");

-- CreateIndex
-- Vigencia (hallazgo alto): permite filtrar eficientemente las
-- asignaciones activas/vigentes de un usuario sin escanear toda la tabla.
CREATE INDEX "user_company_assignments_firebase_uid_active_valid_until_idx" ON "user_company_assignments"("firebase_uid", "active", "valid_until");

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_company_assignments" ADD CONSTRAINT "user_company_assignments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
-- Hallazgo critico PR#4: FK compuesta (branch_id, company_id) hacia
-- branches(id, company_id) en vez de una FK simple solo por branch_id.
-- Esto hace imposible, a nivel de base de datos, insertar una asignacion
-- cuya sede pertenezca a una empresa distinta de la indicada en
-- company_id - antes esto era responsabilidad exclusiva (y fallida) de
-- la capa de aplicacion.
ALTER TABLE "user_company_assignments" ADD CONSTRAINT "user_company_assignments_branch_id_company_id_fkey" FOREIGN KEY ("branch_id", "company_id") REFERENCES "branches"("id", "company_id") ON DELETE RESTRICT ON UPDATE CASCADE;
