# Evidencia — PR #73 Backend (feature/cierre-huecos-20261012) — Módulo Recruitment

**PR:** #73 (`feature/cierre-huecos-20261012`)  
**Última actualización:** 2026-10-13  
**Slice:** Reclutamiento — pausar vacante, honorarios de prueba, CV firmado, negociación, onboarding  
**Commits principales:** `9a04c3b` (feat), `7364cbf` (review P0/P1), `b6f322c` (aprobaciones)

---

## Hallazgos de revisión y estado

| ID | Severidad | Descripción | Estado |
|----|-----------|-------------|--------|
| P0-ARCH-1 | P0→✅ | `recruitment-rules.ts` importaba `VacancyStatus` directamente de `@prisma/client` (violación capa dominio) | Resuelto — `domain/recruitment-domain-types.ts` creado; dominio desacoplado |
| P1-E3-2 | P1→✅ | Endpoint `complete-onboarding` (operación crítica) sin `RecentAuthGuard` | Resuelto — `@UseGuards(RecentAuthGuard) @RecentAuth(300)` añadido a `candidates.controller.ts` |
| P1-E6-3 | P1→✅ | Migración `20261012020000_recruitment_closure` sin comentario de rollback para ADD VALUE irreversible | Resuelto — comentario de procedimiento de rollback añadido al SQL |
| E0-2 | P1→✅ | `recruitment.yaml` v0.2.0 no estaba registrado en `source-manifest.yaml` | Resuelto — `OPENAPI-RECRUITMENT-V0.2.0` añadido al manifiesto |
| E6-1 | P1→✅ | `VacancyStatus.PAUSADA` sin respaldo en BDD ni decision-log | Resuelto — `DEC-REC-001` registrado en `docs/decision-log.md` (2026-10-13); BR-REC-010 formalizado en BDD-REC v1.8 (2026-10-13) |

---

## Tests ejecutados

| Suite | Comando | Resultado | Fecha |
|-------|---------|-----------|-------|
| Módulo recruitment (12 suites, 156 tests) | `npx jest --testPathPatterns="modules/recruitment"` | 156 PASS | 2026-10-13 |
| Nuevos specs de cierre (6 archivos, 127 tests) | Ejecutados de forma aislada por qa-gatekeeper | 127 PASS | 2026-10-13 |

### Specs incluidos en este PR

| Archivo | Cubre |
|---------|-------|
| `recruitment-closure-rules.spec.ts` | Transiciones PAUSADA, assertVacancyPausable/Resumable |
| `recruitment-closure-handlers.spec.ts` | pause-vacancy, resume-vacancy, complete-onboarding |
| `recruitment-closure.mapper.spec.ts` | Mapper de respuesta closure |
| `recruitment-openapi.contract.spec.ts` | Contrato v0.2.0 vs DTOs vs controller |
| `domain/recruitment-domain-types.ts` | (archivo fuente, no spec) |
| `gcs-candidate-cv.service.spec.ts` | URL firmada GCS |

---

## Artefactos relacionados

- Trazabilidad: `artifacts/traceability/recruitment/REC-PR73-traceability.md`
- Contrato OpenAPI: `packages/contracts/openapi/recruitment.yaml` v0.2.0
- Source manifest: `docs/source-manifest.yaml` (OPENAPI-RECRUITMENT-V0.2.0 — current)
- Decisión PAUSADA: `docs/decision-log.md` (DEC-REC-001, 2026-10-13)
- Fuentes aprobadas: BDD-KAIROS-MVP-002-REC v1.8 (BR-REC-010 + @SC-REC-005), SDD-KAIROS-MVP-002-REC v2.0

---

## Riesgos y pendientes

1. **Integration tests — RESUELTO (P1)**: `apps/api/test/integration/recruitment-tenant-isolation.integration.spec.ts` creado en este PR. 3 tests con PostgreSQL real (Testcontainers) cubriendo aislamiento multiempresa de vacantes (empresa A no visible desde empresa B).
2. **DEC-REC-001 — RESUELTO (P1)**: BR-REC-010 formalizado en `bdd-05-reclutamiento-y-seleccion.md` v1.8 con 4 escenarios @SC-REC-005. source-manifest.yaml actualizado a v1.8.
