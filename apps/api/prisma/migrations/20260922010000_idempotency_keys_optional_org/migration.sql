-- Hallazgo ALTO de revision PR#6 ("idempotencia no implementada"):
-- organization_id pasa de NOT NULL a nullable porque IdempotencyInterceptor
-- (nuevo, common/http/idempotency.interceptor.ts) corre a nivel HTTP,
-- antes de que el handler resuelva el organizationId real via
-- WorkContextAuthorizationService - la fila se crea sin ese dato.
ALTER TABLE "idempotency_keys" ALTER COLUMN "organization_id" DROP NOT NULL;
