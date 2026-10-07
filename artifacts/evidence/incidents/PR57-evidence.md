# Evidencia — Módulo Incidencias (PR #57)

**PR:** #57 (`feature/incidents-module-api`)  
**Fecha:** 2026-10-07  
**Autor:** Equipo backend KAIROS

---

## Spec files del módulo incidents

| Archivo | Tipo |
|---|---|
| `apps/api/src/modules/incidents/domain/incident-rules.spec.ts` | Unitaria — reglas de dominio |
| `apps/api/src/modules/incidents/application/commands/create-incident.handler.spec.ts` | Unitaria — handler creación |
| `apps/api/src/modules/incidents/application/commands/incident-transitions.handlers.spec.ts` | Unitaria — handlers de transición de estado |
| `apps/api/src/modules/incidents/application/policies/incident-role-policy.spec.ts` | Unitaria — política de roles |
| `apps/api/src/modules/incidents/application/queries/incident-queries.handlers.spec.ts` | Unitaria — handlers de consulta |
| `apps/api/src/modules/incidents/infrastructure/persistence/prisma-incident.repository.spec.ts` | Integración — repositorio Prisma |
| `apps/api/src/modules/incidents/presentation/http/incidents-openapi.contract.spec.ts` | Contrato — OpenAPI |
| `apps/api/src/modules/incidents/incidents.module.spec.ts` | Módulo NestJS |

---

## Estado de ejecución

Tests ejecutados en CI — ver GitHub Actions run de PR #57.

> **Nota:** Node 22 requerido para ejecutar localmente.  
> Activar con: `export PATH="/opt/homebrew/opt/node@22/bin:$PATH"` o `nvm use 22`  
> Luego: `cd apps/erp-monolithic-api && npm run test:api -- --testPathPattern=incidents`

---

## Hallazgos resueltos (review PR #57)

| ID | Severidad | Descripción | Estado |
|---|---|---|---|
| P1-INC-001 | P1 | Trazabilidad formal ausente | Resuelto — ver `artifacts/traceability/incidents/PR57-incidents-module.md` |
| P1-INC-002 | P1 | Carpeta de evidencia ausente | Resuelto — este archivo |
| P1-INC-003 | P1 | Referencia a fuente inexistente `PANTALLAS-V2-B-SOPORTE.md` en `incident-role-policy.ts` | Resuelto — actualizado a `UX/UI v3.1 §5.8 INC-01/INC-02 + incidents.yaml v0.1.0` |
| P2-INC-001 | P2 | Rollback de migración no documentado | Resuelto — comentario inline en `20261006120000_add_incidents_module/migration.sql` |

---

## Riesgos y pendientes

- Ningún riesgo crítico abierto al momento del merge.
- La migración `20261006120000_add_incidents_module` no puede ejecutarse contra producción automáticamente (requiere autorización manual per CLAUDE.md §7).
