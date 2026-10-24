-- Rollback para 20261023100001_hr_documents_and_sensitive_data

DELETE FROM "role_permission_matrix_versions"
WHERE "action" IN ('VIEW_EMPLOYEE_SENSITIVE_DATA', 'MANAGE_HR_DOCUMENTS', 'VIEW_HR_DOCUMENTS', 'CONFIRM_HR_DOCUMENT_READ');

DROP TABLE IF EXISTS "hr_document_reads";
DROP TABLE IF EXISTS "hr_documents";

ALTER TABLE "employees"
  DROP COLUMN IF EXISTS "bank_name",
  DROP COLUMN IF EXISTS "bank_account_number",
  DROP COLUMN IF EXISTS "bank_account_cci",
  DROP COLUMN IF EXISTS "contract_type",
  DROP COLUMN IF EXISTS "contract_url",
  DROP COLUMN IF EXISTS "contract_notes";
