# Trazabilidad — UC-CON-004 Convertir Consulta en Alquiler

**Slice:** Consultas — conversión directa a alquiler  
**PR:** #55 (`feature/inquiry-to-rental-api`)  
**Fecha:** 2026-10-06

---

## Cadena de trazabilidad

```
BDD → SDD → TDD → OpenAPI → código → pruebas → evidencia
```

### BDD

| ID | Archivo | Regla / Escenario |
|---|---|---|
| BDD-KAIROS-MVP-002-CON | `docs/sources/bdd/bdd-01-consulta.md` | BR-CON-002 (conversión directa a alquiler), SC-CON-003 (escenario de conversión exitosa) |

### SDD

| ID | Archivo | Proceso / Componente |
|---|---|---|
| SDD-KAIROS-MVP-002-CON | `docs/sources/sdd/sdd-01-consulta.md` | CON-P09 (flujo de conversión Consulta → Alquiler directo) |

### TDD

| ID | Archivo | Versión |
|---|---|---|
| TDD-KAIROS-MVP-002-CON | `docs/sources/tdd/tdd-01-consulta.md` | v2.0 |

### OpenAPI

| ID | Archivo | Versión | Endpoint |
|---|---|---|---|
| OPENAPI-INQUIRIES-V0.4.0 | `packages/contracts/openapi/inquiries.yaml` | 0.4.0 | POST /inquiries/{id}/commands/convert-to-rental |

---

## Código implementado

| Capa | Ruta |
|---|---|
| Command | `apps/api/src/modules/inquiries/application/commands/convert-to-rental.command.ts` |
| Handler | `apps/api/src/modules/inquiries/application/commands/convert-to-rental.handler.ts` |
| DTO (request) | `apps/api/src/modules/inquiries/presentation/http/dto/convert-to-rental.dto.ts` |
| DTO (response) | `apps/api/src/modules/inquiries/presentation/http/dto/convert-to-rental.response.ts` |
| Guard (creación) | `apps/api/src/modules/rentals/application/services/rental-creation.guard.ts` |

---

## Pruebas

| Tipo | Ruta | Cubre |
|---|---|---|
| Unitaria (handler) | `apps/api/src/modules/inquiries/application/commands/convert-to-rental.handler.spec.ts` | UC-CON-004 flujo happy path + edge cases |
| Unitaria (guard) | `apps/api/src/modules/rentals/application/services/rental-creation.guard.spec.ts` | Validaciones previas a la creación del alquiler |

---

## Evidencia

- Ver `artifacts/evidence/inquiries/PR55-evidence.md`

---

## Notas

- No aplica UX-ID / PROTO-ID: este slice es exclusivamente backend (API).
- El handler `ConvertToRentalHandler` reutiliza `RentalCreationGuard` (módulo Rentals) para validar disponibilidad del vehículo — sin duplicar lógica.
- Aislamiento multiempresa garantizado: `organizationId`, `operatingCompanyId` y `branchId` se inyectan desde `WorkContextAuthorizationService`, no desde el cuerpo de la petición.
- La regla BR-RES-002 (traslado de depósito de reserva) no aplica a este UC (origen directo, sin reserva previa).
