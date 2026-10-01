# Evidencia — PR #36 Backend (feature/rental-extensions-api)

**PR:** #36 (`feature/rental-extensions-api`)  
**Última actualización:** 2026-10-01  
**Slice:** UC-ALQ-001 a UC-ALQ-006  
**Commits principales:** `2352316` (feat rentals + UC-ALQ-006), `fca7e6b` (review findings resolved)

---

## Hallazgos de revisión y estado

| ID | Severidad | Descripción | Estado |
|----|-----------|-------------|--------|
| BACK-P0-1 | P0→✅ | IDOR potencial en `formalize-contract.handler.ts` — plantilla de contrato sin validar ownership de empresa | Resuelto — `contractTemplateBelongsToCompany()` en port + repositorio + handler guard |
| BACK-P0-2 | P0→✅ | Rama requería rebase sobre main antes del merge | `git rebase origin/main` limpio (commit fca7e6b) |
| BACK-P1-1 | P1→✅ | Migración `20260930000000_add_rentals_module` sin plan de rollback documentado | Resuelto — NOTA-MIGR-RENTALS-001 en docs/decision-log.md |
| BACK-P1-2 | P1→✅ | `rentals.yaml` carecía de códigos de error 401/403/400/500 en 13 endpoints | Resuelto — rentals.yaml v1.0.0 incluye códigos completos; registrado en source-manifest.yaml |
| BACK-P1-3 | P1→✅ | Tests ausentes para handlers de comandos/queries | Resuelto — 6 specs unitarias + 2 specs de integración añadidas |
| BACK-P2-1 | P2→✅ | Trazabilidad ausente en artifacts/ | Resuelto — UC-ALQ-001-006.md creado con cadena BDD→OpenAPI→código→tests |

---

## Tests ejecutados

| Suite | Comando | Resultado |
|-------|---------|-----------|
| Unitarios rentals | `npm run test:api -- --testPathPattern=rentals` | 407 PASS (2026-10-01) |
| Total proyecto | `npm run test:api` | 407 PASS (0 failed) |

### Nuevas specs añadidas en este PR

| Archivo | Tests | Cubre |
|---------|-------|-------|
| `validate-documents.handler.spec.ts` | 4 | UC-ALQ-002 |
| `evaluate-notary.handler.spec.ts` | 4 | UC-ALQ-003 |
| `approve-notary-exception.handler.spec.ts` | 4 | UC-ALQ-003 excepción |
| `formalize-contract.handler.spec.ts` | 5 | UC-ALQ-004 + IDOR guard |
| `get-rental.handler.spec.ts` | 3 | Consulta individual |
| `list-rentals.handler.spec.ts` | 4 | Paginación y filtros |
| `rentals.integration.spec.ts` | Integración | Requiere Testcontainers |
| `rentals-tenant-isolation.integration.spec.ts` | Integración | Aislamiento multiempresa |
| `rentals-openapi.contract.spec.ts` | Contrato | Contrato vs controller vs DTOs |

---

## Artefactos relacionados

- Trazabilidad: `artifacts/traceability/rentals/UC-ALQ-001-006.md`
- Contrato OpenAPI: `packages/contracts/openapi/rentals.yaml` v1.0.0
- Source manifest: `docs/source-manifest.yaml` (OPENAPI-RENTALS-V1.0.0)
- Decisión rollback: `docs/decision-log.md` (NOTA-MIGR-RENTALS-001)

---

## Riesgos y pendientes

1. **Tests de integración**: `rentals.integration.spec.ts` y `rentals-tenant-isolation.integration.spec.ts` requieren Testcontainers (PostgreSQL). No ejecutables en CI sin infraestructura Docker. Se ejecutarán en el gate de QA.
2. **Conflictos pre-existentes no relacionados**: `CONFLICT-CON-001.md`, `CONFLICT-CON-002.md`, `CONFLICT-FLO-001.md` — módulo Consultas, scope distinto, no bloquean este PR.
