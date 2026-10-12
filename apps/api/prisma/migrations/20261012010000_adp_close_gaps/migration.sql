-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "firebase_uid" VARCHAR(128);

-- AlterTable
ALTER TABLE "attendance_records" ADD COLUMN     "justification" TEXT,
ADD COLUMN     "reclassified_at" TIMESTAMP(3),
ADD COLUMN     "reclassified_by_id" TEXT;

-- AlterTable
ALTER TABLE "field_trip_requests" ADD COLUMN     "rejected_by_id" TEXT,
ADD COLUMN     "rejected_by_name" VARCHAR(200),
ADD COLUMN     "rejected_at" TIMESTAMP(3),
ADD COLUMN     "rejected_at_level" INTEGER,
ADD COLUMN     "rejection_reason" TEXT;

-- CreateTable
CREATE TABLE "leave_evidence" (
    "id" TEXT NOT NULL,
    "leave_id" TEXT NOT NULL,
    "object_url" TEXT NOT NULL,
    "content_type" VARCHAR(100) NOT NULL,
    "uploaded_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_memos" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "kind" VARCHAR(40) NOT NULL,
    "source_type" VARCHAR(40) NOT NULL,
    "source_id" TEXT NOT NULL,
    "violation_number" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "issued_on" DATE NOT NULL,
    "generated_by" VARCHAR(40) NOT NULL DEFAULT 'SISTEMA',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hr_memos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_sessions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "operating_company_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "topic" VARCHAR(200) NOT NULL,
    "held_on" DATE NOT NULL,
    "duration_minutes" INTEGER NOT NULL DEFAULT 60,
    "comprehension_notes" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "training_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_attendees" (
    "training_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,

    CONSTRAINT "training_attendees_pkey" PRIMARY KEY ("training_id","employee_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "employees_company_firebase_uid_key" ON "employees"("operating_company_id", "firebase_uid");

-- CreateIndex
CREATE INDEX "leave_evidence_leave_idx" ON "leave_evidence"("leave_id");

-- CreateIndex
CREATE UNIQUE INDEX "leave_evidence_leave_object_key" ON "leave_evidence"("leave_id", "object_url");

-- CreateIndex
CREATE INDEX "hr_memos_employee_issued_idx" ON "hr_memos"("employee_id", "issued_on");

-- CreateIndex
CREATE UNIQUE INDEX "hr_memos_source_key" ON "hr_memos"("source_type", "source_id");

-- CreateIndex
CREATE INDEX "training_sessions_company_held_idx" ON "training_sessions"("operating_company_id", "held_on");

-- CreateIndex
CREATE INDEX "training_attendees_employee_idx" ON "training_attendees"("employee_id");

-- AddForeignKey
ALTER TABLE "leave_evidence" ADD CONSTRAINT "leave_evidence_leave_id_fkey" FOREIGN KEY ("leave_id") REFERENCES "leave_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_memos" ADD CONSTRAINT "hr_memos_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_attendees" ADD CONSTRAINT "training_attendees_training_id_fkey" FOREIGN KEY ("training_id") REFERENCES "training_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_attendees" ADD CONSTRAINT "training_attendees_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
