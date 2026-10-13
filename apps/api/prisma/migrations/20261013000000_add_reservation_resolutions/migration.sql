-- UC-RES-004 / BR-RES-007 (RES-06, RES-07) - resolucion ante la venta de un vehiculo reservado.
-- Escrita A MANO (nunca `migrate dev`), sin CONCURRENTLY; nombres de indice <= 63 caracteres.
--
-- Desviaciones respecto al DDL de TDD-RES-001.md 9.3 (ver DEC-RES-SALE-001 en docs/decision-log.md):
-- - `customer_decision` es NULLABLE: la fila nace al registrar la venta (flag-sale) como resolucion
--   ABIERTA (NULL = pendiente) y se cierra con resolve-sale ('ACCEPTED' | 'REJECTED').
-- - `refund_id` (FK a payments) no existe: no hay modulo Payments. El reembolso del rechazo se
--   modela como `refund_status = 'PENDING_TRANSFER'` (Gerencia transfiere a mano), sin integracion.
-- - Se agregan original_vehicle_id / offered_vehicle_id / offer_note / flagged_* / resolution_note /
--   resolved_by para que la pantalla RES-07 muestre la oferta pendiente sin otra tabla.
-- - Los ids son TEXT (igual que reservations/vehicles en este esquema), no uuid.

-- CreateTable
CREATE TABLE "reservation_resolutions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "reservation_id" TEXT NOT NULL,
    "reason" VARCHAR(30) NOT NULL DEFAULT 'VEHICLE_SOLD',
    "original_vehicle_id" TEXT NOT NULL,
    "offered_vehicle_id" TEXT,
    "offer_note" TEXT,
    "flagged_by" TEXT NOT NULL,
    "flagged_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "customer_decision" VARCHAR(20),
    "alternative_vehicle_id" TEXT,
    "refund_status" VARCHAR(30),
    "resolution_note" TEXT,
    "resolved_by" TEXT,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "reservation_resolutions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reservation_resolutions_reservation_idx" ON "reservation_resolutions"("reservation_id", "flagged_at");

-- AddForeignKey
ALTER TABLE "reservation_resolutions" ADD CONSTRAINT "reservation_resolutions_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Integridad (Prisma 5 no declara CHECK ni indices parciales; defensa en profundidad, la validacion
-- de aplicacion sigue siendo la primera linea):
-- customer_decision (TDD 9.3: reservation_resolution_decision) y coherencia decision <-> resolved_at.
ALTER TABLE "reservation_resolutions" ADD CONSTRAINT "reservation_resolution_decision"
    CHECK ("customer_decision" IS NULL OR "customer_decision" IN ('ACCEPTED', 'REJECTED'));
ALTER TABLE "reservation_resolutions" ADD CONSTRAINT "reservation_resolution_resolved_coherent"
    CHECK (("customer_decision" IS NULL) = ("resolved_at" IS NULL));
ALTER TABLE "reservation_resolutions" ADD CONSTRAINT "reservation_resolution_refund_status"
    CHECK ("refund_status" IS NULL OR "refund_status" IN ('PENDING_TRANSFER'));

-- A lo sumo UNA resolucion abierta (pendiente de decision) por reserva.
CREATE UNIQUE INDEX "reservation_resolutions_one_open_idx" ON "reservation_resolutions"("reservation_id") WHERE "customer_decision" IS NULL;
