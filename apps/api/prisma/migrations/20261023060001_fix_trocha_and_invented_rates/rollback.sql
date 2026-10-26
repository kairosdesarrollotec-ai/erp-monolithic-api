-- Rollback para 20261023060001_fix_trocha_and_invented_rates
-- NOTA DE NEGOCIO Y AUDITORIA:
-- Este rollback NO restaura los valores inventados (suitable_for_trocha=true ni tarifas derivadas del fallback 150)
-- por tratarse de datos ficticios no autorizados por la documentacion oficial ni por la gerencia.
-- Si se requiere revertir esta migracion, los valores deben ser ingresados manualmente desde el modulo Flota
-- por un usuario con permiso de edicion de tarifas.
SELECT 1;
