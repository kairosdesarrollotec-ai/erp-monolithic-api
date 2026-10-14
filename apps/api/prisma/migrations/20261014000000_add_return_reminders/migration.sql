-- BR-DEV-004 / DAT-DEV-001 (DEC-DEV-REMINDER-001) - recordatorio de devolucion 3 h antes de la hora pactada.
-- Escrita A MANO (nunca `migrate dev`), sin CONCURRENTLY; nombres de indice <= 63 caracteres.
-- El envio por WhatsApp es manual-asistido: el scheduler inserta la fila PENDING con el texto y el operador
-- registra el resultado (SENT | FAILED). Una fila por devolucion (return_id UNIQUE) => generacion idempotente.

-- CreateEnum
CREATE TYPE "ReturnReminderStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "return_reminders" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "operating_company_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "return_id" TEXT NOT NULL,
    "status" "ReturnReminderStatus" NOT NULL DEFAULT 'PENDING',
    "due_at" TIMESTAMP(3) NOT NULL,
    "message_text" TEXT NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMP(3),
    "sent_by" TEXT,
    "result_note" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "return_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "return_reminders_return_id_key" ON "return_reminders"("return_id");

-- CreateIndex
CREATE INDEX "idx_return_reminders_scope_status_due" ON "return_reminders"("organization_id", "operating_company_id", "branch_id", "status", "due_at");

-- AddForeignKey
ALTER TABLE "return_reminders" ADD CONSTRAINT "return_reminders_return_id_fkey" FOREIGN KEY ("return_id") REFERENCES "returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Integridad (Prisma 5 no declara CHECK; defensa en profundidad, la validacion funcional vive en el handler):
-- un recordatorio ENVIADO/FALLIDO siempre lleva la hora del registro; PENDING no.
ALTER TABLE "return_reminders" ADD CONSTRAINT "return_reminders_sent_at_chk"
    CHECK (("status" = 'PENDING' AND "sent_at" IS NULL) OR ("status" IN ('SENT', 'FAILED') AND "sent_at" IS NOT NULL));
