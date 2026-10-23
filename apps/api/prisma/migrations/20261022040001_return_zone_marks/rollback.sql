-- Rollback de 20261022040001_return_zone_marks (aplicar a mano). Se pierden las marcas por zona persistidas (los eventos de auditoria permanecen).
DROP TABLE IF EXISTS "return_zone_marks";
