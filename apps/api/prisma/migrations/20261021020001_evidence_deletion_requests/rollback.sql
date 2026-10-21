-- Rollback de 20261021020001_evidence_deletion_requests (aplicar a mano; NO lo ejecuta Prisma).
-- Solo se pierde el historial de solicitudes de eliminacion; la evidencia real (rental_evidence / return_evidence) no se toca.
-- ADVERTENCIA: las solicitudes EXECUTED son el unico rastro de que evidencia se elimino y por que; exportar antes si hay que conservarlo.
DROP TABLE IF EXISTS "evidence_deletion_requests";
