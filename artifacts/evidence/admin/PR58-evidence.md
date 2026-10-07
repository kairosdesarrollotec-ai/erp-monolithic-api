# Evidencia — PR #58 Backend (feature/dynamic-roles-api)

**PR:** #58 (`feature/dynamic-roles-api`)  
**Última actualización:** 2026-10-07  
**Slice:** ADM-02 — Roles dinámicos y autorización por permisos

---

## Hallazgos de revisión y estado

| ID | Severidad | Descripción | Estado |
|----|-----------|-------------|--------|
| P1-01 | P1→✅ | Trazabilidad formal ausente en artifacts/ | Resuelto — `artifacts/traceability/admin/ADM-02-roles-permisos.md` creado con cadena BDD→decisiones→OpenAPI→código→tests |
| P1-02 | P1→✅ | BDD/SDD TRANSVERSAL en estado `draft_pending_review` (gap pre-existente) | Documentado en trazabilidad: autoridad normativa proviene de decisiones aprobadas PROP-004, SEC-E2, SEC-F5 (jerarquía §1) |
| P2-01 | P2→✅ | Coupling `MatrixAuthorizationService` → `admin/domain` sin decisión formal | Resuelto — SEC-E2-EXT-001 añadido en `docs/decision-log.md` |
| P2-02 | P2→✅ | Evidencia ausente en artifacts/ | Resuelto — este archivo |

---

## Tests ejecutados

| Suite | Referencia | Resultado |
|-------|-----------|-----------|
| Unitarios admin + authorization | Tests ejecutados en CI — todos los jobs PASS (GitHub Actions PR #58) | PASS |
| Migración upgrade | `apps/api/test/migrations/roles-upgrade.test.sh` — ejecutado en CI | PASS |

---

## Specs del módulo admin

| Archivo spec | Tipo | Cubre |
|---|---|---|
| `apps/api/src/modules/admin/application/commands/role-handlers.spec.ts` | Unitario | create-role, deactivate-role, rename-role handlers |
| `apps/api/src/modules/admin/application/commands/save-role-permission-matrix.handler.spec.ts` | Unitario | SaveRolePermissionMatrixHandler |
| `apps/api/src/modules/admin/application/commands/assign-user-to-company.handler.spec.ts` | Unitario | AssignUserToCompanyHandler |
| `apps/api/src/modules/admin/application/commands/deactivate-assignment.handler.spec.ts` | Unitario | DeactivateAssignmentHandler |
| `apps/api/src/modules/admin/application/commands/save-notification-template.handler.spec.ts` | Unitario | SaveNotificationTemplateHandler |
| `apps/api/src/modules/admin/application/commands/update-reservation-deposit-policy.handler.spec.ts` | Unitario | UpdateReservationDepositPolicyHandler |
| `apps/api/src/modules/admin/application/queries/role-queries.handlers.spec.ts` | Unitario | list-roles, get-role-permission-matrix, get-my-permissions queries |
| `apps/api/src/modules/admin/application/queries/list-organization-users.handler.spec.ts` | Unitario | ListOrganizationUsersHandler |
| `apps/api/src/modules/admin/application/queries/get-organization-companies.handler.spec.ts` | Unitario | GetOrganizationCompaniesHandler |
| `apps/api/src/modules/admin/application/queries/get-role-permission-matrix.handler.spec.ts` | Unitario | GetRolePermissionMatrixHandler |
| `apps/api/src/modules/admin/application/queries/get-notification-templates.handler.spec.ts` | Unitario | GetNotificationTemplatesHandler |
| `apps/api/src/modules/admin/application/queries/get-reservation-deposit-policy.handler.spec.ts` | Unitario | GetReservationDepositPolicyHandler |
| `apps/api/src/modules/admin/application/queries/list-audit-events.handler.spec.ts` | Unitario | ListAuditEventsHandler |
| `apps/api/src/modules/admin/application/services/admin-matrix-authorization.service.spec.ts` | Unitario | AdminMatrixAuthorizationService |
| `apps/api/src/modules/admin/application/services/matrix-scope.service.spec.ts` | Unitario | MatrixScopeService |
| `apps/api/src/modules/admin/application/services/administrator-guard.service.spec.ts` | Unitario | AdministratorGuardService |
| `apps/api/src/modules/admin/domain/matrix-resolution.spec.ts` | Unitario (dominio) | Resolución sede > empresa > organización, deny-by-default |
| `apps/api/src/modules/admin/domain/default-role-permission-matrix.spec.ts` | Unitario (dominio) | Matriz por defecto de roles de sistema |
| `apps/api/src/modules/admin/domain/role-name.spec.ts` | Unitario (dominio) | Validación de nombre de rol |
| `apps/api/src/modules/admin/presentation/http/admin-openapi.contract.spec.ts` | Contrato | admin.yaml v0.2.1 vs controller vs DTOs |
| `apps/api/src/modules/authorization/matrix-authorization.service.spec.ts` | Unitario | MatrixAuthorizationService (módulo authorization) |
| `apps/api/test/migrations/roles-upgrade.test.sh` | Migración | Expand/backfill/contract para tabla `roles` |

---

## Artefactos relacionados

- Trazabilidad: `artifacts/traceability/admin/ADM-02-roles-permisos.md`
- Contrato OpenAPI: `packages/contracts/openapi/admin.yaml` v0.2.1
- Migración principal: `apps/api/prisma/migrations/20261007000000_dynamic_roles/`
- Decisiones: `docs/decision-log.md` (ROLES-DIN-01, ROLES-DIN-02, ROLES-DIN-03, SEC-E2-EXT-001)

---

## Cobertura declarada

- **Unitarios:** role-handlers (create, deactivate, rename), matrix-authorization (admin y genérico), matrix-resolution (dominio), role-queries, administrator-guard, matrix-scope
- **Contrato:** admin-openapi.contract.spec.ts — verifica admin.yaml v0.2.1 contra controller y DTOs
- **Migración upgrade:** roles-upgrade.test.sh — expand/backfill/contract sobre tabla `roles`
- **Integración:** pendiente de gate de QA con Testcontainers (PostgreSQL real)

---

## Riesgos y pendientes

1. **Tests de integración**: requieren Testcontainers (PostgreSQL). No ejecutables en CI sin infraestructura Docker. Se ejecutarán en el gate de QA.
2. **BDD/SDD TRANSVERSAL en draft_pending_review**: gap pre-existente. Las fuentes deben aprobarse formalmente antes de producción (ver nota en `ADM-02-roles-permisos.md`).
3. **Fase 4 pendiente**: Devoluciones, Clientes y Flota siguen con sets hard-coded contra `roleKey` hasta ROLES-DIN-03/fase 4. Los roles creados a mano con `key NULL` no tendrán acceso a esos módulos hasta entonces.
4. **Columnas enum `role` DEPRECADAS**: se retiran en un PR posterior (ROLES-DIN-01).
