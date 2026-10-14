# Evidencia — PR #76

**PR:** #76 — feat(reservations): RES-06/07/08, conversión a CONVERTED y change-vehicle
**Branch:** feature/reservas-res06-07-08-20261013
**Fecha:** 2026-10-13
**CI:** ✅ todos los checks pasaron (4/4)

---

## CI checks

| Job | Resultado |
|---|---|
| Typecheck, build y tests unitarios/contrato | ✅ SUCCESS |
| Migraciones, drift, upgrade e integración (PostgreSQL real) | ✅ SUCCESS |
| SBOM (CycloneDX) | ✅ SUCCESS |
| SCA y secret scanning | ✅ SUCCESS |

---

## Tests ejecutados (verificados en CI)

| Suite | Descripción | Resultado |
|---|---|---|
| `flag-vehicle-sale.handler.spec.ts` | Autorización GERENCIA/ADMINISTRACION, estado CONFIRMED, versión atómica, guard alternativo, auditoría y outbox | ✅ |
| `resolve-vehicle-sale.handler.spec.ts` | REJECT (CANCELLED + PENDING_TRANSFER), ACCEPT_ALTERNATIVE (DRAFT + alternativo), sin alternativa (error), FRONT_OFFICE bloqueado | ✅ |
| `change-reservation-vehicle.handler.spec.ts` | DRAFT requerido, validación del vehículo, atomicidad, auditoría | ✅ |
| `create-rental-from-reservation.handler.spec.ts` | +4 casos: conversión atómica CONVERTED, race condition 409, idempotencia, reserva cancelada | ✅ |
| `recruitment-scope.spec.ts` | 8 handlers — IDs de otra sede devuelven 404; repositorios verifican filtros Prisma con scope completo | ✅ |
| `hr-administration-scope.spec.ts` | Handlers críticos de HR — IDs de otra sede devuelven 404; repositorios verifican filtros multiempresa | ✅ |
| `reservations-openapi.contract.spec.ts` | FlagVehicleSaleRequest, ResolveVehicleSaleRequest, enums de decisión, 3 nuevos endpoints, 7 códigos de error | ✅ |

---

## Migración incluida

| Archivo | Tipo | Riesgo |
|---|---|---|
| `20261013000000_add_reservation_resolutions` | Tabla nueva — reservation_resolutions | Bajo (tabla nueva, sin locks en tablas existentes) |

Rollback: `DROP TABLE reservation_resolutions; DROP INDEX reservation_resolutions_one_open_idx;`

---

## Desvíos documentados

Ninguno. Todos los cambios siguen el stack aprobado y la arquitectura hexagonal estándar.

---

## Pendientes (no bloquean CI)

| # | Descripción |
|---|---|
| P1-01 | BDD-KAIROS-MVP-002-RES en pending_review (ver traceability) |
| P2-03 | Preguntas abiertas para Fiorella (DEC-RES-SALE-001-OQ, DEC-RES-CHANGE-VEHICLE-001-OQ) |
| P2-04 | `startDatePassed` sin huso horario explícito — supuesto UTC no documentado |
