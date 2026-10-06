-- Rollback: 20261005130000_returns_fix_index_names
-- Restaura los nombres de índice anteriores (antes del renombrado de alineación con Prisma).

ALTER INDEX IF EXISTS "returns_organization_id_operating_company_id_branch_id_stat_idx"
  RENAME TO "returns_organization_id_operating_company_id_branch_id_sta_idx";

ALTER INDEX IF EXISTS "return_evidence_organization_id_operating_company_id_return_idx"
  RENAME TO "return_evidence_organization_id_operating_company_id_retu_idx";
