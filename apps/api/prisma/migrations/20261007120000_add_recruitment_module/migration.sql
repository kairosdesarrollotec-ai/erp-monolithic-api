-- CreateEnum
CREATE TYPE "VacancySource" AS ENUM ('RENUNCIA', 'CRECIMIENTO', 'NUEVA_AREA');

-- CreateEnum
CREATE TYPE "VacancyStatus" AS ENUM ('NECESIDAD_REGISTRADA', 'PUBLICADA', 'EN_NEGOCIACION', 'DECIDIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "CandidateStage" AS ENUM ('NUEVO', 'CONTACTADO', 'ENTREVISTA', 'DECISION');

-- CreateEnum
CREATE TYPE "CandidateDecision" AS ENUM ('CONTRATADO', 'RECHAZADO');

-- CreateEnum
CREATE TYPE "InterviewResult" AS ENUM ('PENDIENTE', 'AVANZA', 'NO_AVANZA');

-- CreateTable
CREATE TABLE "vacancies" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "operating_company_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "department" VARCHAR(100) NOT NULL,
    "source" "VacancySource" NOT NULL,
    "status" "VacancyStatus" NOT NULL DEFAULT 'NECESIDAD_REGISTRADA',
    "is_mechanic" BOOLEAN NOT NULL DEFAULT false,
    "profile_description" TEXT,
    "base_salary" DECIMAL(10,2),
    "schedule_details" VARCHAR(255),
    "published_channels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT NOT NULL,

    CONSTRAINT "vacancies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidates" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "operating_company_id" TEXT NOT NULL,
    "vacancy_id" TEXT NOT NULL,
    "full_name" VARCHAR(200) NOT NULL,
    "document_type" VARCHAR(20) NOT NULL DEFAULT 'DNI',
    "document_number" VARCHAR(30) NOT NULL,
    "email" VARCHAR(150),
    "phone" VARCHAR(50),
    "cv_document_id" TEXT NOT NULL,
    "salary_expectation" DECIMAL(10,2),
    "stage" "CandidateStage" NOT NULL DEFAULT 'NUEVO',
    "score" DECIMAL(5,2),
    "decision" "CandidateDecision",
    "decision_notes" TEXT,
    "decided_by" TEXT,
    "decided_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidate_interviews" (
    "id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "is_virtual" BOOLEAN NOT NULL DEFAULT true,
    "meet_url" VARCHAR(255),
    "location" VARCHAR(255),
    "interviewer_id" TEXT NOT NULL,
    "qualitative_notes" TEXT,
    "result" "InterviewResult" NOT NULL DEFAULT 'PENDIENTE',
    "evaluated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "candidate_interviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_onboardings" (
    "id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "induction_scheduled" BOOLEAN NOT NULL DEFAULT false,
    "equipment_assigned" BOOLEAN NOT NULL DEFAULT false,
    "responsibility_card_signed" BOOLEAN NOT NULL DEFAULT false,
    "notarized_contract_signed" BOOLEAN NOT NULL DEFAULT false,
    "is_completed" BOOLEAN NOT NULL DEFAULT false,
    "completed_at" TIMESTAMP(3),
    "completed_by" TEXT,
    "probation_evaluation" TEXT,
    "probation_passed" BOOLEAN,
    "probation_evaluated_at" TIMESTAMP(3),
    "probation_evaluated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_onboardings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vacancies_scope_status_created_idx" ON "vacancies"("organization_id", "operating_company_id", "branch_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "vacancies_company_created_idx" ON "vacancies"("operating_company_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "vacancies_operating_company_id_code_key" ON "vacancies"("operating_company_id", "code");

-- CreateIndex
CREATE INDEX "candidates_vacancy_id_stage_idx" ON "candidates"("vacancy_id", "stage");

-- CreateIndex
CREATE UNIQUE INDEX "candidates_vacancy_id_document_number_key" ON "candidates"("vacancy_id", "document_number");

-- CreateIndex
CREATE INDEX "candidate_interviews_candidate_id_scheduled_at_idx" ON "candidate_interviews"("candidate_id", "scheduled_at");

-- CreateIndex
CREATE UNIQUE INDEX "employee_onboardings_candidate_id_key" ON "employee_onboardings"("candidate_id");

-- AddForeignKey
ALTER TABLE "vacancies" ADD CONSTRAINT "vacancies_operating_company_id_organization_id_fkey" FOREIGN KEY ("operating_company_id", "organization_id") REFERENCES "companies"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vacancies" ADD CONSTRAINT "vacancies_branch_id_operating_company_id_fkey" FOREIGN KEY ("branch_id", "operating_company_id") REFERENCES "branches"("id", "company_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_vacancy_id_fkey" FOREIGN KEY ("vacancy_id") REFERENCES "vacancies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_interviews" ADD CONSTRAINT "candidate_interviews_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_onboardings" ADD CONSTRAINT "employee_onboardings_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

