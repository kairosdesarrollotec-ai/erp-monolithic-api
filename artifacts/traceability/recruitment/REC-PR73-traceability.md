# Trazabilidad Backend — Módulo Reclutamiento (PR #73)

**Slice:** Cierre de huecos Reclutamiento — pausar vacante, honorarios de prueba, CV firmado y negociación  
**PR:** #73 (`feature/cierre-huecos-20261012`)  
**Commits principales:** `9a04c3b` (feat recruitment), `7364cbf` (review fixes P0/P1), `b6f322c` (aprobaciones fuentes)  
**Fecha:** 2026-10-13

---

## Fuentes verificadas

| ID | Tipo | Versión | Estado |
|----|------|---------|--------|
| BDD-KAIROS-MVP-002-REC | BDD | 1.7 | approved (2026-10-13) |
| SDD-KAIROS-MVP-002-REC | SDD | 2.0 | approved (2026-10-13) |
| TDD-KAIROS-MVP-002-REC | TDD | 2.0 | approved |
| OPENAPI-RECRUITMENT-V0.2.0 | OpenAPI | 0.2.0 | current (en source-manifest 2026-10-13) |
| DEC-REC-001 | decision-log | — | CONFIRMADO 2026-10-13 (VacancyStatus.PAUSADA) |

---

## Cadena BDD → código → prueba por caso de uso

### REC-02 — Pausar / Reanudar vacante (DEC-REC-001)

| BDD / Decisión | SDD ref | Código | Prueba |
|----------------|---------|--------|--------|
| DEC-REC-001 assertVacancyPausable | SDD-REC §pausar | `commands/pause-vacancy.handler.ts` | `recruitment-closure-handlers.spec.ts` |
| DEC-REC-001 assertVacancyResumable | SDD-REC §reanudar | `commands/resume-vacancy.handler.ts` | `recruitment-closure-handlers.spec.ts` |
| DEC-REC-001 ALLOWED_VACANCY_TRANSITIONS | — | `domain/recruitment-rules.ts` | `recruitment-closure-rules.spec.ts` |
| DEC-REC-001 VacancyStatus.PAUSADA | — | `domain/recruitment-domain-types.ts` | `recruitment-closure-rules.spec.ts` |

### REC-03 — CV de candidato con URL firmada

| BDD | SDD ref | Código | Prueba |
|-----|---------|--------|--------|
| REC-03 RequestCvUpload | SDD-REC §cv | `commands/request-candidate-cv-upload-session.handler.ts` | `recruitment-handlers.spec.ts` |
| REC-03 RecordCandidateCv | SDD-REC §cv | `commands/record-candidate-cv.handler.ts` | `recruitment-handlers.spec.ts` |
| DAT-REC-004 assertCandidateCvFile | — | `domain/recruitment-rules.ts` | `recruitment-rules.spec.ts` |
| DAT-REC-004 assertCandidateCvObjectOwned | — | `domain/recruitment-rules.ts` | `recruitment-rules.spec.ts` |
| — | — | `infrastructure/storage/gcs-candidate-cv.service.ts` | `gcs-candidate-cv.service.spec.ts` |

### REC-04 — Condiciones de negociación (ronda de oferta)

| BDD | SDD ref | Código | Prueba |
|-----|---------|--------|--------|
| REC-04 assertNegotiationValid | SDD-REC §negociacion | `domain/recruitment-rules.ts` | `recruitment-rules.spec.ts` |
| REC-04 RecordNegotiation | SDD-REC §negociacion | `commands/record-negotiation.handler.ts` | `recruitment-handlers.spec.ts` |
| REC-04 maskCandidateSensitiveFields | DAT-REC-007 | `domain/recruitment-rules.ts` | `recruitment-rules.spec.ts` |

### REC-04 — Honorarios periodo de prueba

| BDD | SDD ref | Código | Prueba |
|-----|---------|--------|--------|
| REC-04 SetProbationFees | SDD-REC §honorarios | `commands/set-probation-fees.handler.ts` | `recruitment-handlers.spec.ts` |
| REC-08 applyOnboardingFeeVisibility | DAT-REC-007 | `domain/recruitment-rules.ts` | `recruitment-rules.spec.ts` |

### REC-05 — Completar onboarding (RecentAuthGuard)

| BDD | SDD ref | Código | Prueba |
|-----|---------|--------|--------|
| REC-05 CompleteOnboarding (mechanic) | SDD-REC §onboarding | `commands/complete-onboarding.handler.ts` | `recruitment-closure-handlers.spec.ts` |
| TDD-00 §8.4 MFA 5min | — | `candidates.controller.ts @RecentAuth(300)` | `recruitment-closure-handlers.spec.ts` |
| BDD-REC assertOnboardingValid | SDD-REC §onboarding | `domain/recruitment-rules.ts` | `recruitment-rules.spec.ts` |
| BDD-REC assertMechanicChannels | SDD-REC §canales | `domain/recruitment-rules.ts` | `recruitment-rules.spec.ts` |

---

## Dominio desacoplado de @prisma/client (P0 resuelto)

| Archivo | Descripción |
|---------|-------------|
| `domain/recruitment-domain-types.ts` | Tipos de dominio locales: `VacancyStatus`, `CandidateDecision`, `CandidateStage`, `NegotiationOutcome` |

El dominio ya no importa directamente de `@prisma/client` — hallazgo P0 de arquitectura resuelto en commit `7364gbf`.

---

## Migración

| Archivo | Cambio | Reversibilidad |
|---------|--------|----------------|
| `prisma/migrations/20261012020000_recruitment_closure/migration.sql` | `ALTER TYPE VacancyStatus ADD VALUE 'PAUSADA'` | Irreversible — comentario de rollback procedure añadido |

---

## Contrato OpenAPI

| Contrato | Versión | Endpoints cubiertos |
|----------|---------|---------------------|
| `packages/contracts/openapi/recruitment.yaml` | 0.2.0 | pause-vacancy, resume-vacancy, record-negotiation, set-probation-fees, complete-onboarding, request-cv-upload, record-cv |

---

## Pruebas

| Suite | Archivo | Tests | Resultado |
|-------|---------|-------|-----------|
| Domain rules | `recruitment-rules.spec.ts` | — | PASS 2026-10-13 |
| Closure rules | `recruitment-closure-rules.spec.ts` | — | PASS 2026-10-13 |
| Closure handlers | `recruitment-closure-handlers.spec.ts` | — | PASS 2026-10-13 |
| OpenAPI contract | `recruitment-openapi.contract.spec.ts` | — | PASS 2026-10-13 |
| GCS CV service | `gcs-candidate-cv.service.spec.ts` | — | PASS 2026-10-13 |
| Closure mapper | `recruitment-closure.mapper.spec.ts` | — | PASS 2026-10-13 |
| All recruitment (12 suites) | — | 156 | PASS 2026-10-13 (Etapa 7 qa-gatekeeper) |

---

## Evidencia

- `artifacts/evidence/recruitment/PR73-evidence.md`

---

## Riesgos y pendientes

1. **Integration tests ausentes**: No existen `recruitment-tenant-isolation.integration.spec.ts` ni `recruitment.integration.spec.ts` análogos a los de rentals. Aislamiento multiempresa validado únicamente por mocks. Pendiente como tarea post-PR (ver Etapa 7 finding P1).
2. **DEC-REC-001 provisional**: La decisión PAUSADA es provisional hasta que BDD-REC-v1.8 formalice BR-REC-PAU-001. Sin bloquear merge.
