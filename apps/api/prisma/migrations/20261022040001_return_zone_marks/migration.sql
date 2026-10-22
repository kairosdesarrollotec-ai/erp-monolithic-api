-- DEV-05 / PD-07 (G2, 22-oct-2026): marcas "Sin daño"/"Con daño" por zona del comparador, persistidas en el servidor.
-- Escrita A MANO (nunca `migrate dev`), aditiva, sin CONCURRENTLY. Una fila por (devolucion, zona).

-- CreateTable
CREATE TABLE "return_zone_marks" (
    "id" TEXT NOT NULL,
    "return_id" TEXT NOT NULL,
    "zone" VARCHAR(30) NOT NULL,
    "mark" VARCHAR(10) NOT NULL,
    "marked_by" TEXT NOT NULL,
    "marked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "return_zone_marks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "return_zone_marks_return_id_zone_key" ON "return_zone_marks"("return_id", "zone");

-- AddForeignKey
ALTER TABLE "return_zone_marks" ADD CONSTRAINT "return_zone_marks_return_id_fkey" FOREIGN KEY ("return_id") REFERENCES "returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Integridad (Prisma no declara CHECK; la validacion funcional vive en el handler).
ALTER TABLE "return_zone_marks" ADD CONSTRAINT "return_zone_marks_mark_chk" CHECK ("mark" IN ('NO_DAMAGE', 'DAMAGE'));
ALTER TABLE "return_zone_marks" ADD CONSTRAINT "return_zone_marks_zone_chk" CHECK ("zone" IN ('FRONTAL', 'LATERAL_IZQUIERDO', 'LATERAL_DERECHO', 'POSTERIOR', 'INTERIOR'));
