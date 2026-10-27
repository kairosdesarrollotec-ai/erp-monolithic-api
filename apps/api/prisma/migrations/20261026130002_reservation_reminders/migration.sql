-- C3: Recordatorio 3 h antes del recojo de una reserva (reutiliza patron return_reminders)
CREATE TYPE "ReservationReminderStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

CREATE TABLE "reservation_reminders" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "operating_company_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "reservation_id" TEXT NOT NULL,
    "status" "ReservationReminderStatus" NOT NULL DEFAULT 'PENDING',
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

    CONSTRAINT "reservation_reminders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "reservation_reminders_reservation_id_key" ON "reservation_reminders"("reservation_id");
CREATE INDEX "idx_reservation_reminders_scope_status_due" ON "reservation_reminders"("organization_id", "operating_company_id", "branch_id", "status", "due_at");
ALTER TABLE "reservation_reminders" ADD CONSTRAINT "reservation_reminders_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
