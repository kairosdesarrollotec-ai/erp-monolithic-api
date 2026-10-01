# Trazabilidad — Adaptadores Prisma de Flota y Tarifario (Inquiries Backend)

**Fecha:** 2026-10-01  
**Módulo:** Inquiries (adaptadores de infraestructura)  
**Rama:** `feature/flota-clientes-admin-disponible`

---

## 1. Cadena de trazabilidad

| Eslabón | Referencia | Estado |
|---------|-----------|--------|
| **BDD** | `docs/sources/bdd/bdd-01-consulta.md` v1.8 (BR-CON-005: cotización versionada) | pending_review |
| **SDD** | `docs/sources/sdd/sdd-01-consulta.md` v2.1 | draft_pending_review |
| **TDD** | `docs/sources/tdd/tdd-01-consulta.md` v2.0 §9/11.2 (tarifario versionado, elegibilidad) | approved |
| **OpenAPI** | N/A — adaptadores internos, sin endpoints nuevos | — |
| **Código** | `modules/inquiries/infrastructure/fleet/`, `modules/inquiries/infrastructure/pricing/` | Implementado |
| **Pruebas** | `prisma-fleet-availability.adapter.spec.ts` (8 tests), `prisma-rate-card.adapter.spec.ts` (7 tests) | Unitarios passing |
| **Evidencia** | Pendiente de registro en `artifacts/evidence/` | — |

---

## 2. Archivos implementados

| Archivo | Propósito |
|---------|-----------|
| `infrastructure/fleet/prisma-fleet-availability.adapter.ts` | Adapter real de elegibilidad vehicular (reemplaza provisional) |
| `infrastructure/fleet/prisma-fleet-availability.adapter.spec.ts` | 8 tests unitarios |
| `infrastructure/pricing/prisma-rate-card.adapter.ts` | Adapter real de tarifario versionado (reemplaza PROP-007) |
| `infrastructure/pricing/prisma-rate-card.adapter.spec.ts` | 7 tests unitarios |
| `application/ports/fleet-availability.port.ts` | Puerto abstracto de elegibilidad |
| `application/ports/rate-card.port.ts` | Puerto abstracto de tarifario |
| `inquiries.module.ts` | Wiring NestJS: provisional → Prisma adapters |

---

## 3. Decisiones

- PROP-007 (tarifario provisional) queda reemplazado por `PrismaRateCardAdapter`.
- `PrismaRateCardAdapter.currentFor()` filtra por `organizationId` + `operatingCompanyId` (defensa en profundidad multiempresa, §8 CLAUDE.md).
- `PrismaFleetAvailabilityAdapter.checkEligibility()` filtra por `organizationId` + `operatingCompanyId` + `vehicleId` + branch.

---

## 4. Cobertura pendiente

- Tests de integración con DB real para ambos adapters.
- Test de aislamiento multiempresa (query con orgId de otra empresa).
