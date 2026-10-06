-- Alinea los nombres de índice con los que Prisma espera (identificadores truncados a 63 caracteres)
-- para eliminar el drift entre migraciones y schema.prisma.
ALTER INDEX "returns_organization_id_operating_company_id_branch_id_sta_idx"
  RENAME TO "returns_organization_id_operating_company_id_branch_id_stat_idx";
ALTER INDEX "return_evidence_organization_id_operating_company_id_retu_idx"
  RENAME TO "return_evidence_organization_id_operating_company_id_return_idx";
