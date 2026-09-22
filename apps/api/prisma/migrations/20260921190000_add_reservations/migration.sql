-- HU-27 (Reserva) - tablas nuevas: customers, vehicles, inquiries,
-- reservations, reservation_acceptances.
--
-- Hallazgo de revision PR#6 ("no existe migracion para el modulo de
-- Reserva"): el commit original de HU-27 (29e741b) agrego estos modelos
-- a schema.prisma pero nunca genero una migracion SQL para ellos - solo
-- existian aplicados via `prisma db push` (o ni eso, en este entorno sin
-- Prisma engine). Esta es la primera migracion real de estas 5 tablas,
-- ya con las correcciones de la revision incorporadas desde el origen
-- (no se migra primero "roto" y se corrige despues):
--
-- - `inquiries.organization_id` (hallazgo critico "referencias
--   cross-tenant al crear"): sin este campo era imposible validar que
--   una Inquiry citada por una Reserva perteneciera a la misma
--   organizacion que la asignacion validada del usuario.
-- - FK compuesta `(branch_id, operating_company_id)` en `reservations`
--   hacia `branches(id, company_id)` (hallazgo critico "IDOR entre
--   sedes/empresas" + mismo patron que `user_company_assignments` desde
--   PR#4): a nivel de base de datos ya no es posible insertar una
--   reserva cuya sede pertenezca a una empresa distinta de
--   `operating_company_id`.
-- - CHECK constraints (hallazgo medio "integridad solo en aplicacion",
--   ver nota en el modelo Reservation de schema.prisma): Prisma 5 no
--   expone CHECK constraints declarativos, se agregan a mano aqui como
--   defensa en profundidad - NO reemplazan la validacion de aplicacion
--   existente (fechas en CreateReservationHandler, completitud de
--   requisitos en ConfirmReservationHandler), la complementan.
--
-- Generada y revisada a mano contra el mismo limite de red que
-- 20260918000000_init (sin salida hacia binaries.prisma.sh en este
-- entorno sandbox, ver docs/decision-log.md PROP-003/NOTA-PROP-003):
-- correr en un entorno con red completa antes de mergear:
--   npx prisma generate
--   npx prisma migrate dev
-- para que Prisma re-valide/re-genere esta migracion oficialmente.

-- CreateEnum
CREATE TYPE "ChannelMode" AS ENUM ('PRESENCIAL', 'VIRTUAL');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'PENDING_SALE_RESOLUTION', 'CONVERTED', 'CANCELLED');

-- CreateTable
-- Hallazgo ALTO "referencias corregidas solo a nivel organizacion, no
-- empresa/sede" (revision PR#6): operating_company_id agregado para que
-- customers pueda tener FK compuesta (id, operating_company_id) hacia
-- companies, cerrando el cruce cross-company que antes solo se evitaba
-- (parcialmente) a nivel de organizacion.
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "operating_company_id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "document_type" TEXT NOT NULL,
    "document_number" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
-- Mismo razonamiento que customers.operating_company_id arriba.
CREATE TABLE "vehicles" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "operating_company_id" TEXT NOT NULL,
    "plate" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
-- Hallazgo critico "referencias cross-tenant al crear": organization_id
-- agregado (faltaba en el modelo original) para poder validar que la
-- Inquiry citada pertenece a la misma organizacion que la asignacion
-- validada del usuario. operating_company_id agregado ademas por el
-- hallazgo ALTO "referencias corregidas solo a nivel organizacion, no
-- empresa/sede" (revision PR#6) - mismo razonamiento que en customers.
CREATE TABLE "inquiries" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "operating_company_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inquiries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservations" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "operating_company_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "inquiry_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'DRAFT',
    "channel_mode" "ChannelMode" NOT NULL,
    "start_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3) NOT NULL,
    "required_payment_amount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "payment_policy_version" INTEGER NOT NULL,
    "payment_validated_at" TIMESTAMP(3),
    "documents_completed_at" TIMESTAMP(3),
    "confirmed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservation_acceptances" (
    "id" TEXT NOT NULL,
    "reservation_id" TEXT NOT NULL,
    "evidence_ref" TEXT NOT NULL,
    "terms_version" TEXT NOT NULL,
    "accepted_by_customer_id" TEXT NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "recorded_by" TEXT NOT NULL,

    CONSTRAINT "reservation_acceptances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_plate_key" ON "vehicles"("plate");

-- CreateIndex
-- Necesarias como objetivo de las FKs compuestas (id, operating_company_id)
-- que reservations usa hacia customers/vehicles/inquiries (hallazgo ALTO
-- "referencias corregidas solo a nivel organizacion, no empresa/sede").
CREATE UNIQUE INDEX "customers_id_operating_company_id_key" ON "customers"("id", "operating_company_id");

-- CreateIndex
CREATE INDEX "customers_operating_company_id_idx" ON "customers"("operating_company_id");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_id_operating_company_id_key" ON "vehicles"("id", "operating_company_id");

-- CreateIndex
CREATE INDEX "vehicles_operating_company_id_idx" ON "vehicles"("operating_company_id");

-- CreateIndex
CREATE UNIQUE INDEX "inquiries_id_operating_company_id_key" ON "inquiries"("id", "operating_company_id");

-- CreateIndex
CREATE INDEX "inquiries_operating_company_id_idx" ON "inquiries"("operating_company_id");

-- CreateIndex
-- Hallazgo critico "IDOR entre sedes/empresas": respalda el filtro de
-- scope completo (organization_id + operating_company_id + branch_id)
-- que usan findById/list/las mutaciones del repositorio de Reserva.
CREATE INDEX "reservations_organization_id_operating_company_id_branch__idx" ON "reservations"("organization_id", "operating_company_id", "branch_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "reservations_customer_id_created_at_idx" ON "reservations"("customer_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "reservation_acceptances_reservation_id_key" ON "reservation_acceptances"("reservation_id");

-- AddForeignKey
-- Hallazgo ALTO "referencias corregidas solo a nivel organizacion, no
-- empresa/sede" (revision PR#6): las 3 FKs siguientes pasan de simples
-- (solo *_id) a compuestas (*_id, operating_company_id) hacia
-- (id, operating_company_id) de cada entidad - a nivel de base de datos
-- ya no es posible que una reserva cite una inquiry/customer/vehicle que
-- pertenezca a una empresa distinta de la propia operating_company_id de
-- la reserva, cerrando el IDOR cross-company que la FK simple no evitaba.
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_inquiry_id_operating_company_id_fkey" FOREIGN KEY ("inquiry_id", "operating_company_id") REFERENCES "inquiries"("id", "operating_company_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_customer_id_operating_company_id_fkey" FOREIGN KEY ("customer_id", "operating_company_id") REFERENCES "customers"("id", "operating_company_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_vehicle_id_operating_company_id_fkey" FOREIGN KEY ("vehicle_id", "operating_company_id") REFERENCES "vehicles"("id", "operating_company_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
-- FK compuesta (operating_company_id, organization_id) -> companies(id,
-- organization_id): mismo patron que company/organization desde PR#4 -
-- impide que operating_company_id pertenezca a una organizacion distinta
-- de organization_id.
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_operating_company_id_organization_id_fkey" FOREIGN KEY ("operating_company_id", "organization_id") REFERENCES "companies"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
-- FKs propias de customers/vehicles/inquiries hacia companies, requeridas
-- para que las FKs compuestas de reservations arriba puedan referenciar
-- (id, operating_company_id) en cada una de estas 3 tablas.
ALTER TABLE "customers" ADD CONSTRAINT "customers_operating_company_id_fkey" FOREIGN KEY ("operating_company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_operating_company_id_fkey" FOREIGN KEY ("operating_company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_operating_company_id_fkey" FOREIGN KEY ("operating_company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
-- Hallazgo critico "IDOR entre sedes/empresas": FK compuesta
-- (branch_id, operating_company_id) hacia branches(id, company_id),
-- mismo patron que user_company_assignments desde PR#4 - impide a nivel
-- de base de datos que branch_id pertenezca a una empresa distinta de
-- operating_company_id.
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_branch_id_operating_company_id_fkey" FOREIGN KEY ("branch_id", "operating_company_id") REFERENCES "branches"("id", "company_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_acceptances" ADD CONSTRAINT "reservation_acceptances_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Hallazgo medio "integridad solo en aplicacion" (defensa en
-- profundidad - no reemplaza la validacion de aplicacion existente):

-- El periodo de la reserva siempre debe ser positivo (ya validado en
-- CreateReservationHandler, se refuerza aqui a nivel de base de datos).
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_period_check" CHECK ("start_at" < "end_at");

-- version es un contador optimista de concurrencia (If-Match) que
-- arranca en 1 y solo puede crecer - nunca 0 o negativo.
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_version_check" CHECK ("version" >= 1);

-- El monto de deposito vigente (BR-RES-001) siempre es positivo.
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_required_payment_amount_check" CHECK ("required_payment_amount" > 0);

-- BR-RES-009/DR-RES-002 (bloqueo atomico unico): una reserva solo puede
-- estar en CONFIRMED si pago, documentos y confirmed_at estan los 3
-- presentes - nunca CONFIRMED con alguno de los 3 en null. No restringe
-- los demas estados (DRAFT/PENDING_SALE_RESOLUTION/CONVERTED/CANCELLED
-- pueden tener cualquier combinacion de estos 3 campos).
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_confirmed_requires_requirements_check" CHECK (
    "status" <> 'CONFIRMED'
    OR ("payment_validated_at" IS NOT NULL AND "documents_completed_at" IS NOT NULL AND "confirmed_at" IS NOT NULL)
);
