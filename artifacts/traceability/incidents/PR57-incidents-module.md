# Trazabilidad — Módulo Incidencias (INC-01 / INC-02)

**Slice:** Incidencias — registro, acciones, resolución y cierre  
**PR:** #57 (`feature/incidents-module-api`)  
**Fecha:** 2026-10-07

---

## Cadena de trazabilidad

```
BDD → SDD → TDD → UX/UI → Prototipos → OpenAPI → código → pruebas → evidencia
```

### BDD

| ID | Archivo | Módulo |
|---|---|---|
| BDD-KAIROS-MVP-002-TRANSVERSAL | `docs/sources/bdd/bdd-01-transversal.md` | Transversal |
| BDD-KAIROS-MVP-002-DEV | `docs/sources/bdd/bdd-04-devoluciones.md` | Devoluciones (BR-DEV-009: incidencias nacen de devolución) |

### SDD

| ID | Archivo | Módulo |
|---|---|---|
| SDD-KAIROS-MVP-002-TRANSVERSAL | `docs/sources/sdd/sdd-01-transversal.md` | Transversal |
| SDD-KAIROS-MVP-002-DEV | `docs/sources/sdd/sdd-04-devoluciones.md` | Devoluciones |

### TDD

| ID | Archivo | Módulo |
|---|---|---|
| TDD-KAIROS-MVP-002-TRANSVERSAL | `docs/sources/tdd/tdd-01-transversal.md` | Transversal |
| TDD-KAIROS-MVP-002-DEV | `docs/sources/tdd/tdd-04-devoluciones.md` | Devoluciones |

### UX/UI

| ID | Sección | Descripción |
|---|---|---|
| INC-01 | UX/UI v3.1 §5.8 | Bandeja de incidencias (Front-office, Gerencia, Finanzas, Auditoría) |
| INC-02 | UX/UI v3.1 §5.8 | Detalle / resolución de incidencia (Front-office, Gerencia) |

### Prototipos aprobados

| PROTO-ID | Estado | UX-ID | Descripción |
|---|---|---|---|
| PROTO-INC-01-BANDEJA | APPROVED | INC-01 | Bandeja de incidencias |
| PROTO-INC-02-DETALLE-INCIDENCIA-INC-0234 | APPROVED | INC-02 | Detalle de incidencia INC-0234 |

### OpenAPI

| ID | Archivo | Versión |
|---|---|---|
| OPENAPI-INCIDENTS-V0.1.0 | `packages/contracts/openapi/incidents.yaml` | 0.1.0 |

---

## Casos de uso cubiertos

| UC | Descripción |
|---|---|
| INC-01 | Consultar bandeja de incidencias (listado con filtros por estado, tipo, sede) |
| INC-02 | Ver detalle de incidencia, agregar acción, resolver, cerrar, derivar a vía legal |

---

## Código implementado

| Capa | Ruta |
|---|---|
| Módulo | `apps/api/src/modules/incidents/` |
| Dominio | `apps/api/src/modules/incidents/domain/` |
| Comandos/Handlers | `apps/api/src/modules/incidents/application/commands/` |
| Queries/Handlers | `apps/api/src/modules/incidents/application/queries/` |
| Políticas | `apps/api/src/modules/incidents/application/policies/` |
| Persistencia | `apps/api/src/modules/incidents/infrastructure/persistence/` |
| Presentación HTTP | `apps/api/src/modules/incidents/presentation/http/` |
| Migración | `apps/api/prisma/migrations/20261006120000_add_incidents_module/migration.sql` |

---

## Pruebas

| Tipo | Ruta |
|---|---|
| Unitarias (dominio) | `apps/api/src/modules/incidents/domain/incident-rules.spec.ts` |
| Unitarias (create handler) | `apps/api/src/modules/incidents/application/commands/create-incident.handler.spec.ts` |
| Unitarias (transitions handlers) | `apps/api/src/modules/incidents/application/commands/incident-transitions.handlers.spec.ts` |
| Unitarias (policies) | `apps/api/src/modules/incidents/application/policies/incident-role-policy.spec.ts` |
| Unitarias (queries handlers) | `apps/api/src/modules/incidents/application/queries/incident-queries.handlers.spec.ts` |
| Integración (repositorio) | `apps/api/src/modules/incidents/infrastructure/persistence/prisma-incident.repository.spec.ts` |
| Contrato OpenAPI | `apps/api/src/modules/incidents/presentation/http/incidents-openapi.contract.spec.ts` |
| Módulo NestJS | `apps/api/src/modules/incidents/incidents.module.spec.ts` |

---

## Evidencia

- Ver `artifacts/evidence/incidents/PR57-evidence.md`

---

## Notas

- Incidencias nacen de devoluciones (BR-DEV-009): el campo `rental_id` es obligatorio; `return_id` es opcional (puede registrarse durante o posterior a la devolución).
- Política de roles: deny-by-default. Escribe: FRONT_OFFICE y GERENCIA. Lee: FRONT_OFFICE, GERENCIA, FINANZAS y AUDITORIA. PLATFORM_ADMIN tiene acceso total. Fuente: UX/UI v3.1 §5.8 INC-01/INC-02.
- Aislamiento multiempresa garantizado por `organization_id`, `operating_company_id` y `branch_id` en la tabla `incidents` (ADR-KAI-007).
- La migración `20261006120000_add_incidents_module` crea 2 tablas (`incidents`, `incident_actions`), 4 enums, 4 índices y 5 FKs. Plan de rollback documentado inline en la migración.
- Hallazgos P1/P2 resueltos antes del merge: P1-INC-001 (trazabilidad ausente), P1-INC-002 (evidencia ausente), P1-INC-003 (referencia a fuente inexistente PANTALLAS-V2-B-SOPORTE.md), P2-INC-001 (rollback no documentado en migración).
