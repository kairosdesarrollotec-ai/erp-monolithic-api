-- Seguimiento de revalidacion de PR#7 (comentario sobre fe840c5):
-- "checksum historico mutable de 20260923120000_add_dashboard_items".
--
-- a6cb090 corrigio el nombre truncado del indice de dashboard_items
-- (branc_idx -> branch_idx, mismo hallazgo de drift ya corregido en
-- d0ebc83 para reservations) editando in-place una migracion ya
-- aplicada/pusheada (7186eb5) - exactamente el mismo problema que se
-- viene corrigiendo hoy para add_reservations/fix_company_organization_
-- integrity/fix_company_fk_drift/init/add_worker_role (ver
-- decision-log.md NOTA-PR6-WORKERROLE-UPGRADE y el historial de esta
-- rama). Se restaura 20260923120000_add_dashboard_items a su forma
-- original (7186eb5, indice truncado "branc_idx") y el rename se aplica
-- aqui como migracion forward-only, sin editar nada ya aplicado.
ALTER INDEX "dashboard_items_organization_id_operating_company_id_branc_idx"
  RENAME TO "dashboard_items_organization_id_operating_company_id_branch_idx";
