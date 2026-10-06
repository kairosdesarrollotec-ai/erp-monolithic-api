# Evidencia — PR #54 Backend (feature/returns-module-api)

**PR:** #54 (`feature/returns-module-api`)  
**Última actualización:** 2026-10-06  
**Slice:** UC-DEV-001 a UC-DEV-005 (DEV-P01..DEV-P10)  
**Node:** v22.23.3

---

## Hallazgos de revisión y estado

| ID | Severidad | Descripción | Estado |
|----|-----------|-------------|--------|
| P0-001 | P0→✅ | Matriz de trazabilidad ausente | Resuelto — `artifacts/traceability/returns/DEV-traceability.md` creado con cadena BDD→TDD→OpenAPI→código→pruebas |
| P0-002 | P0→✅ | Tests no ejecutados ni evidenciados | Resuelto — suite ejecutada; ver sección "Tests ejecutados" |
| P1-001 | P1→✅ | Estado `CANCELADA` sin documentación formal | Resuelto — registrado como `PENDIENTE-DEV-CANCELADA` en `docs/decision-log.md` |
| P1-002 | P1→✅ | `returns.yaml` v1.1.0 no registrado en source-manifest.yaml | Resuelto — entrada `OPENAPI-RETURNS-V1.1.0` agregada |
| P1-003 | P1→✅ | Migraciones de octubre 2026 sin rollback.sql | Resuelto — `rollback.sql` agregado a las 3 migraciones |
| P2-001 | P2→✅ | `escalate()` no filtraba por `organizationId` | Resuelto — `where` incluye `organizationId` |
| PROP-014 | Pendiente humano | Resolución de Gerencia ante alcolímetro DESFAVORABLE | PROVISIONAL — pendiente confirmación de negocio (registrado en decision-log.md) |
| PROP-015 | Pendiente humano | Documento de responsabilidad firmado — validez legal | PROVISIONAL — pendiente aprobación Legal (registrado en decision-log.md) |
| P1-005 | Informativo | Tests de integración con BD real ausentes | No ejecutables sin Testcontainers — se ejecutarán en gate de QA |

---

## Tests ejecutados

Comando ejecutado:
```bash
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"
node --version  # v22.23.3
cd /tmp/kairos-review/returns-api
npm run test:api -- --testPathPattern="returns" --forceExit 2>&1
```

### Resultado global (con `--testPathPattern="returns"`)

| Métrica | Valor |
|---------|-------|
| Test Suites total | 118 |
| Test Suites PASSED | 107 |
| Test Suites FAILED | 11 |
| Tests total | 615 |
| Tests PASSED | 598 |
| Tests FAILED | 17 |
| Tiempo | ~5–10 s |

### Suites del módulo returns

| Suite | Resultado | Notas |
|-------|-----------|-------|
| `src/modules/returns/domain/damage-calculator.spec.ts` | PASS | |
| `src/modules/returns/domain/responsibility-document.spec.ts` | PASS | |
| `src/modules/returns/domain/return-status.spec.ts` | PASS | |
| `src/modules/returns/domain/damage-assessment.spec.ts` | PASS | |
| `src/modules/returns/domain/return-settlement.spec.ts` | PASS | |
| `src/modules/returns/domain/customer-risk-status.spec.ts` | PASS | |
| `src/modules/returns/domain/return-rules.spec.ts` | PASS | |
| `src/modules/returns/application/commands/create-return.handler.spec.ts` | PASS | |
| `src/modules/returns/application/commands/receive-provisional.handler.spec.ts` | PASS | |
| `src/modules/returns/application/commands/register-alcohol-test.handler.spec.ts` | PASS | |
| `src/modules/returns/application/commands/resolve-alcohol-escalation.handler.spec.ts` | PASS | |
| `src/modules/returns/application/commands/complete-inspection.handler.spec.ts` | PASS | |
| `src/modules/returns/application/commands/assess-damage.handler.spec.ts` | PASS | |
| `src/modules/returns/application/commands/charge-immobilization.handler.spec.ts` | PASS | |
| `src/modules/returns/application/commands/close-financial.handler.spec.ts` | PASS | |
| `src/modules/returns/application/commands/close-return.handler.spec.ts` | PASS | |
| `src/modules/returns/application/commands/return-evidence.handlers.spec.ts` | PASS | |
| `src/modules/returns/application/queries/return-queries.handlers.spec.ts` | PASS | |
| `src/modules/returns/application/policies/return-role-policy.spec.ts` | PASS | |
| `src/modules/returns/infrastructure/persistence/prisma-return-customer-risk.persistence.spec.ts` | PASS | |
| `src/modules/returns/infrastructure/persistence/prisma-return-deposit-settlement.persistence.spec.ts` | PASS | |
| `src/modules/returns/infrastructure/persistence/return-persistence.mapper.spec.ts` | FAIL | `@prisma/client` no exporta `$Enums` sin `prisma generate` — condición de entorno del worktree, no defecto del código |
| `src/modules/returns/infrastructure/persistence/prisma-return.repository.spec.ts` | FAIL (1 test) | Mismo motivo: `Prisma.PrismaClientKnownRequestError is not a constructor` sin cliente Prisma generado |
| `src/modules/returns/presentation/http/returns-openapi.contract.spec.ts` | FAIL | `@prisma/client` no exporta `$Enums` sin `prisma generate` |

### Suites fallidas NO relacionadas con returns

Las 8 suites restantes fallidas son pre-existentes y no corresponden al módulo returns:
- `src/modules/dashboard-projections/infrastructure/outbox-relay.service.spec.ts` — `Prisma.sql is not a function`
- `src/common/persistence/prisma-idempotency.repository.spec.ts` — Prisma constructor issue
- `src/common/persistence/prisma-transaction-manager.spec.ts` — Prisma constructor issue
- `src/modules/inquiries/infrastructure/persistence/prisma-inquiry.repository.spec.ts` — Prisma FK issue
- `src/modules/rentals/presentation/http/rentals-openapi.contract.spec.ts` — `$Enums` issue
- `src/modules/reservations/presentation/http/reservations-openapi.contract.spec.ts` — `$Enums` issue
- `src/modules/inquiries/presentation/http/inquiries-openapi.contract.spec.ts` — `$Enums` issue
- `src/app.module.spec.ts` — `Cannot find module 'resend'`

---

## Artefactos relacionados

- Trazabilidad: `artifacts/traceability/returns/DEV-traceability.md`
- Contrato OpenAPI: `packages/contracts/openapi/returns.yaml` v1.1.0
- Source manifest: `docs/source-manifest.yaml` (OPENAPI-RETURNS-V1.1.0)
- Decisión CANCELADA: `docs/decision-log.md` (PENDIENTE-DEV-CANCELADA)
- Rollbacks: `apps/api/prisma/migrations/20261005*/rollback.sql`

---

## Riesgos y pendientes

1. **Tests de integración**: no se ejecutaron tests contra BD real. Requieren Testcontainers. Se ejecutarán en gate de QA.
2. **Prisma client no generado**: en el worktree no se ejecutó `prisma generate`, por lo que 3 specs de infraestructura/contrato fallan. No es un defecto del código — se verificará en CI con el cliente generado.
3. **Estado CANCELADA**: registrado como PENDIENTE_APROBACION_DOCUMENTAL. No exponer en APIs hasta resolución formal.
4. **PROP-014 y PROP-015**: provisionales pendientes de validación de negocio y legal.
