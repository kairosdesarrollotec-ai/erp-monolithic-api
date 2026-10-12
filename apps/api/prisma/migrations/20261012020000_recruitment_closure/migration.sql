-- AlterEnum
-- REC-02 "Pausar": estado de vacante PAUSADA (se reanuda a PUBLICADA).
ALTER TYPE "VacancyStatus" ADD VALUE 'PAUSADA';

-- CreateEnum
CREATE TYPE "NegotiationOutcome" AS ENUM ('EN_CURSO', 'ACORDADA', 'NO_ACORDADA');

-- AlterTable
-- DAT-REC-004: archivo del CV del candidato (almacenamiento privado, lectura por URL firmada).
ALTER TABLE "candidates" ADD COLUMN     "cv_content_type" VARCHAR(100),
ADD COLUMN     "cv_file_name" VARCHAR(200),
ADD COLUMN     "cv_object_url" VARCHAR(1024),
ADD COLUMN     "cv_size_bytes" INTEGER,
ADD COLUMN     "cv_uploaded_at" TIMESTAMP(3),
ADD COLUMN     "cv_uploaded_by" TEXT;

-- AlterTable
-- REC-08 / DAT-REC-007: honorarios del periodo de prueba + version para If-Match.
ALTER TABLE "employee_onboardings" ADD COLUMN     "post_probation_monthly_salary" DECIMAL(10,2),
ADD COLUMN     "probation_fee_notes" VARCHAR(500),
ADD COLUMN     "probation_fees_recorded_at" TIMESTAMP(3),
ADD COLUMN     "probation_fees_recorded_by" TEXT,
ADD COLUMN     "probation_monthly_fee" DECIMAL(10,2),
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
-- REC-04: historial append-only de rondas de negociacion de condiciones.
CREATE TABLE "candidate_negotiations" (
    "id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "offered_salary" DECIMAL(10,2) NOT NULL,
    "offered_schedule" VARCHAR(255),
    "offered_other_conditions" TEXT,
    "candidate_salary" DECIMAL(10,2),
    "candidate_schedule" VARCHAR(255),
    "candidate_other_conditions" TEXT,
    "candidate_start_date" DATE,
    "outcome" "NegotiationOutcome" NOT NULL DEFAULT 'EN_CURSO',
    "agreed_salary" DECIMAL(10,2),
    "agreed_conditions" TEXT,
    "reason" TEXT,
    "recorded_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "candidate_negotiations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "candidate_negotiations_candidate_id_created_at_idx" ON "candidate_negotiations"("candidate_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "candidate_negotiations" ADD CONSTRAINT "candidate_negotiations_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
