# Evidencia — PR #73 Backend (feature/cierre-huecos-20261012) — Módulo Rentals

**PR:** #73 (`feature/cierre-huecos-20261012`)  
**Última actualización:** 2026-10-13  
**Slice:** Cierre de huecos Alquiler — reserva trasladada a garantía, plantilla por titular, requisitos de extensión  
**Commits principales:** `4790133` (feat rentals closure), `7364gbf` (review P0/P1)

---

## Hallazgos de revisión y estado

| ID | Severidad | Descripción | Estado |
|----|-----------|-------------|--------|
| P1-E3-1 | P1→✅ | Endpoint `formalize-contract` (operación crítica: firma de expediente) sin `RecentAuthGuard` | Resuelto — `@UseGuards(RecentAuthGuard) @RecentAuth(300)` añadido a `rentals.controller.ts` |
| F-01 | P1→✅ | `rentals.yaml` v1.2.0 no estaba registrado en `source-manifest.yaml` | Resuelto — `OPENAPI-RENTALS-V1.2.0` añadido; v1.1.0 marcado `superseded` |
| P0-03-TRAZ | P0-abierto | `reservation_credit_amount` (traslado íntegro de reserva a garantía) implementado sin regla BDD formal | **Pendiente decisión** — ver nota abajo |

---

## Tests ejecutados

| Suite | Comando | Resultado | Fecha |
|-------|---------|-----------|-------|
| Módulo rentals (26 suites, 182 tests) | `npx jest --testPathPatterns="modules/rentals"` | 182 PASS | 2026-10-13 |

### Specs incluidos en este PR

| Archivo | Cubre |
|---------|-------|
| `reservation-credit.spec.ts` | Traslado de reserva a garantía (lógica `reservation-credit.ts`) |
| `contract-variant.spec.ts` | Variantes de contrato por tipo de titular / con conductor |
| `extension-requirements.spec.ts` | Requisitos de extensión de alquiler |
| `rentals-openapi.contract.spec.ts` | Contrato v1.2.0 vs DTOs vs controller |

---

## Artefactos relacionados

- Trazabilidad: `artifacts/traceability/rentals/UC-ALQ-001-006.md` (PR #36 base) — PR #73 extiende ese slice
- Contrato OpenAPI: `packages/contracts/openapi/rentals.yaml` v1.2.0
- Source manifest: `docs/source-manifest.yaml` (OPENAPI-RENTALS-V1.2.0 — current)
- Fuentes aprobadas: BDD-KAIROS-MVP-002-ALQ v1.7, SDD-KAIROS-MVP-002-ALQ v2.1

---

## Riesgos y pendientes

1. **P0 abierto — `reservation_credit_amount`**: La regla "el monto pagado por la reserva se traslada íntegro a la garantía del alquiler" (implementada en `domain/reservation-credit.ts`) está respaldada por la decisión del dueño del 6-oct-2026 documentada como "P0-03 opcion (a)". Sin embargo, el documento referenciado (`claude/Pregunta_Fiorella_Monto_Reserva.md`) no existe como fuente formal en el repo. **Requiere decisión**: registrar en `decision-log.md` o agregar como regla BDD en `bdd-03-alquiler.md`.
2. **Integration tests rentals con PR73**: Los tests `rentals.integration.spec.ts` y `rentals-tenant-isolation.integration.spec.ts` cubren el slice base (PR #36). Las nuevas operaciones de PR #73 no tienen cobertura de integración con DB real.
