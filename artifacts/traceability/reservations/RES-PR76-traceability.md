# Trazabilidad — Módulo Reserva (RES-06 / RES-07 / RES-08)

**Slice:** Reserva — venta de vehículo reservado, cambio de vehículo en borrador, conversión a CONVERTED, seguridad por sede en Reclutamiento
**PR:** #76 (`feature/reservas-res06-07-08-20261013`)
**Fecha:** 2026-10-13

---

## Cadena de trazabilidad

```
BDD → SDD → TDD → OpenAPI → código → pruebas → evidencia
```

### BDD

| ID | Archivo | Estado | Nota |
|---|---|---|---|
| BDD-KAIROS-MVP-002-RES | `docs/sources/bdd/bdd-02-reserva.md` | pending_review | Autoridad sustituida por DEC-RES-SALE-001, DEC-RES-CONVERT-001, DEC-RES-CHANGE-VEHICLE-001 hasta aprobación formal |
| DEC-RES-CONVERT-001 | `docs/decision-log.md` | APROBADO 2026-10-13 | Autoridad nivel-1 para conversión CONFIRMED→CONVERTED; BR-ALQ-020 no existe en bdd-03-alquiler.md (ver DEC-RES-CONVERT-BR-ALQ-020-2026-10-13) |
| BDD-KAIROS-MVP-002-REC | `docs/sources/bdd/bdd-05-reclutamiento-y-seleccion.md` | approved v1.8 | Seguridad por sede |

### SDD

| ID | Archivo | Estado |
|---|---|---|
| SDD-KAIROS-MVP-002-RES | `docs/sources/sdd/sdd-02-reserva.md` | draft_pending_review v2.2 |
| SDD-KAIROS-MVP-002-ALQ | `docs/sources/sdd/sdd-03-alquiler.md` | draft_pending_review |
| SDD-KAIROS-MVP-002-REC | `docs/sources/sdd/sdd-05-reclutamiento-y-seleccion.md` | draft_pending_review |

### TDD

| ID | Archivo | Estado |
|---|---|---|
| TDD-KAIROS-MVP-002-RES | `docs/sources/tdd/tdd-02-reserva.md` | draft_pending_review v2.2 |
| TDD-KAIROS-MVP-002-ALQ | `docs/sources/tdd/tdd-03-alquiler.md` | approved |
| TDD-KAIROS-MVP-002-REC | `docs/sources/tdd/tdd-05-reclutamiento-y-seleccion.md` | draft_pending_review |

### OpenAPI

| ID | Archivo | Versión |
|---|---|---|
| OPENAPI-RESERVATIONS-V0.7.0 | `packages/contracts/openapi/reservations.yaml` | 0.7.0 |
| OPENAPI-RENTALS-V1.3.0 | `packages/contracts/openapi/rentals.yaml` | 1.3.0 |

---

## Casos de uso cubiertos

| UC / Regla | BDD ref | Código | Test |
|---|---|---|---|
| RES-06 — Cambio de vehículo en borrador | BDD-KAIROS-MVP-002-RES §RES-06 | `ChangeReservationVehicleHandler` | `change-reservation-vehicle.handler.spec.ts` |
| RES-07 — Marcar venta (flag-sale) | BDD-KAIROS-MVP-002-RES §RES-07 | `FlagVehicleSaleHandler` | `flag-vehicle-sale.handler.spec.ts` |
| RES-07 — Resolver venta (resolve-sale) | BDD-KAIROS-MVP-002-RES §RES-07 | `ResolveVehicleSaleHandler` | `resolve-vehicle-sale.handler.spec.ts` |
| RES-08 — Reserva CONVERTED al crear alquiler | DEC-RES-CONVERT-001 | `CreateRentalFromReservationHandler` | `create-rental-from-reservation.handler.spec.ts` |
| SEC-REC — Aislamiento por sede en Reclutamiento | BDD-KAIROS-MVP-002-REC | Todos los handlers de recruitment | `recruitment-scope.spec.ts` |
| SEC-ADP — Aislamiento por sede en Administración de Personal | SDD-KAIROS-MVP-002-ADP | Todos los handlers de hr-administration | `hr-administration-scope.spec.ts` |

## Decisiones registradas

| ID | Descripción |
|---|---|
| DEC-RES-SALE-001 | flag-sale / resolve-sale — autoridad de nivel 1 mientras BDD esté en pending_review |
| DEC-RES-CONVERT-001 | Conversión de reserva a estado CONVERTED al crear el alquiler |
| DEC-RES-CHANGE-VEHICLE-001 | Cambio de vehículo en borrador — sujeto a preguntas abiertas pendientes de Fiorella |

## Pendientes documentales

| # | Descripción | Acción requerida |
|---|---|---|
| P1-01 | BDD-KAIROS-MVP-002-RES en pending_review | Aprobar BDD o registrar amparo formal en decision-log |
| P2-01 | Preguntas abiertas DEC-RES-SALE-001-OQ y DEC-RES-CHANGE-VEHICLE-001-OQ | Resolver con Fiorella |
