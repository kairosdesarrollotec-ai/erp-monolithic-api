-- Reconciles the schema produced by historical migrations with schema.prisma.
ALTER TABLE "hr_document_reads" DROP CONSTRAINT "hr_document_reads_document_version_id_fkey";
ALTER TABLE "hr_document_reads" DROP CONSTRAINT "hr_document_reads_employee_id_fkey";
ALTER TABLE "hr_document_reads" DROP CONSTRAINT "hr_document_reads_operating_company_id_fkey";
ALTER TABLE "hr_document_versions" DROP CONSTRAINT "hr_document_versions_document_id_fkey";
ALTER TABLE "hr_document_versions" DROP CONSTRAINT "hr_document_versions_operating_company_id_fkey";
ALTER TABLE "hr_documents" DROP CONSTRAINT "hr_documents_operating_company_id_fkey";

ALTER TABLE "company_expenses"
  ALTER COLUMN "type" SET DATA TYPE TEXT,
  ALTER COLUMN "currency" SET DATA TYPE CHAR(3),
  ALTER COLUMN "expense_date" SET DATA TYPE TIMESTAMP(3),
  ALTER COLUMN "vehicle_plate" SET DATA TYPE TEXT,
  ALTER COLUMN "reference" SET DATA TYPE TEXT,
  ALTER COLUMN "notes" SET DATA TYPE TEXT,
  ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);
ALTER TABLE "hr_document_reads"
  ALTER COLUMN "read_at" SET DATA TYPE TIMESTAMP(3),
  ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);
ALTER TABLE "hr_document_versions"
  ALTER COLUMN "published_at" SET DATA TYPE TIMESTAMP(3),
  ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);
ALTER TABLE "hr_documents"
  ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
  ALTER COLUMN "updated_at" DROP DEFAULT,
  ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);
ALTER TABLE "quotations" ALTER COLUMN "plan" SET DATA TYPE TEXT;
ALTER TABLE "returns"
  ALTER COLUMN "mechanic_report_accepted_at" SET DATA TYPE TIMESTAMP(3),
  ALTER COLUMN "legal_escalated_at" SET DATA TYPE TIMESTAMP(3);

ALTER TABLE "hr_documents" ADD CONSTRAINT "hr_documents_operating_company_id_fkey"
  FOREIGN KEY ("operating_company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hr_document_versions" ADD CONSTRAINT "hr_document_versions_operating_company_id_fkey"
  FOREIGN KEY ("operating_company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hr_document_versions" ADD CONSTRAINT "hr_document_versions_document_id_fkey"
  FOREIGN KEY ("document_id") REFERENCES "hr_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hr_document_reads" ADD CONSTRAINT "hr_document_reads_operating_company_id_fkey"
  FOREIGN KEY ("operating_company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hr_document_reads" ADD CONSTRAINT "hr_document_reads_document_version_id_fkey"
  FOREIGN KEY ("document_version_id") REFERENCES "hr_document_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hr_document_reads" ADD CONSTRAINT "hr_document_reads_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
