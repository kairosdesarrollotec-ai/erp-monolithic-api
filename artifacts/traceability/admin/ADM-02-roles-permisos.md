# Trazabilidad — Módulo Admin: Roles Dinámicos y Autorización por Permisos (ADM-02)

**Slice:** Roles dinámicos y autorización por permisos  
**PR:** #58 (`feature/dynamic-roles-api`)  
**Fecha:** 2026-10-07

---

## Cadena de trazabilidad

```
BDD → SDD → TDD → Decisiones aprobadas → OpenAPI → código → pruebas → evidencia
```

---

## Fuentes documentales

### BDD

| ID | Archivo | Módulo | Estado en source-manifest |
|---|---|---|---|
| BDD-KAIROS-MVP-002-TRANSVERSAL | `docs/sources/bdd/bdd-00-transversal.md` | Transversal | `draft_pending_review` (v1.18) |
| BDD-KAIROS-MVP-002-ADP | `docs/sources/bdd/bdd-adp-admin.md` | Admin / Permisos | — |

### SDD

| ID | Archivo | Módulo | Estado en source-manifest |
|---|---|---|---|
| SDD-KAIROS-MVP-002-TRANSVERSAL | `docs/sources/sdd/sdd-00-transversal.md` | Transversal | `draft_pending_review` (v3.6) |
| SDD-KAIROS-MVP-002-ADP | `docs/sources/sdd/sdd-adp-admin.md` | Admin / Permisos | — |

### TDD

| ID | Archivo | Módulo | Estado en source-manifest |
|---|---|---|---|
| TDD-KAIROS-MVP-002-TRANSVERSAL | `docs/sources/tdd/tdd-00-transversal.md` | Transversal | — (v3.4) |
| TDD-KAIROS-MVP-002-ADP | `docs/sources/tdd/tdd-adp-admin.md` | Admin / Permisos | — |

### Decisiones aprobadas (jerarquía §1 — source-hierarchy.md)

| ID | Fecha | Descripción resumida |
|---|---|---|
| PROP-004 | 2026-09-16 | Modelo de rol provisional (`WorkerRole`) como puente hasta ADM-02 |
| SEC-E2 | 2026-10-04 | Excepción documentada para cross-module coupling en `admin/domain` |
| SEC-E2-EXT-001 | 2026-10-07 | Extensión: coupling `MatrixAuthorizationService` → `admin/` domain (ver decision-log.md) |
| SEC-F5 | 2026-10-04 | Catálogo provisional 8 roles vs 11 aprobados; bloqueado por no existencia de ADM-02 |
| ROLES-DIN-01 | 2026-10-07 | El rol pasa a ser un dato (tabla `roles`); migración expand/backfill/contract |
| ROLES-DIN-02 | 2026-10-07 | Autorización por `roleId` sin atajo PLATFORM_ADMIN; permisos como filas sembradas |
| ROLES-DIN-03 | 2026-10-07 | Alcance acotado: Devoluciones/Clientes/Flota siguen con sets hard-coded (fase 4 pendiente) |

### OpenAPI

| ID | Archivo | Versión |
|---|---|---|
| OPENAPI-ADMIN-V0.2.1 | `packages/contracts/openapi/admin.yaml` | 0.2.1 |

---

## Nota sobre estado de fuentes BDD/SDD

Las fuentes `BDD-KAIROS-MVP-002-TRANSVERSAL` (v1.18) y `SDD-KAIROS-MVP-002-TRANSVERSAL` (v3.6)
se encuentran en estado `draft_pending_review` en `docs/source-manifest.yaml`. Este es un gap
pre-existente, no introducido por este PR.

De acuerdo con la jerarquía §1 de `source-hierarchy.md`, la autoridad normativa para este PR
la proveen las decisiones explícitamente aprobadas en `docs/decision-log.md`: **PROP-004**,
**SEC-E2** y **SEC-F5** (y sus extensiones/complementos **ROLES-DIN-01**, **ROLES-DIN-02**,
**ROLES-DIN-03**, **SEC-E2-EXT-001**). Las fuentes BDD/SDD quedan pendientes de aprobación
formal; deberán validarse antes de que este módulo entre en producción.

---

## Migración

| Archivo | Descripción |
|---|---|
| `apps/api/prisma/migrations/20261007000000_dynamic_roles/` | Expand/backfill/contract: crea tabla `roles`, siembra 8 roles de sistema, depreca columnas enum `role` |

Migraciones precedentes relacionadas:

| Archivo |
|---|
| `apps/api/prisma/migrations/20260921180000_add_worker_role/` |
| `apps/api/prisma/migrations/20260923200000_add_role_permission_matrix_versions/` |
| `apps/api/prisma/migrations/20260926000000_add_platform_admin_role/` |

---

## Código implementado

### Módulo admin (`apps/api/src/modules/admin/`)

| Capa | Ruta |
|---|---|
| Módulo | `apps/api/src/modules/admin/admin.module.ts` |
| Comandos (roles) | `application/commands/create-role.handler.ts` |
| | `application/commands/deactivate-role.handler.ts` |
| | `application/commands/rename-role.handler.ts` |
| | `application/commands/save-role-permission-matrix.handler.ts` |
| | `application/commands/assign-user-to-company.handler.ts` |
| | `application/commands/deactivate-assignment.handler.ts` |
| Queries (roles) | `application/queries/list-roles.handler.ts` |
| | `application/queries/get-role-permission-matrix.handler.ts` |
| | `application/queries/get-my-permissions.handler.ts` |
| | `application/queries/list-organization-users.handler.ts` |
| | `application/queries/get-organization-companies.handler.ts` |
| Servicios | `application/services/admin-matrix-authorization.service.ts` |
| | `application/services/matrix-scope.service.ts` |
| | `application/services/administrator-guard.service.ts` |
| Ports | `application/ports/role-repository.port.ts` |
| | `application/ports/role-permission-matrix.port.ts` |
| Dominio | `domain/matrix-resolution.ts` |
| | `domain/default-role-permission-matrix.ts` |
| | `domain/permission-action-catalog.ts` |
| | `domain/system-roles.ts` |
| | `domain/role-name.ts` |
| | `domain/role-errors.ts` |
| Infraestructura | `infrastructure/persistence/prisma-role.repository.ts` |
| | `infrastructure/persistence/prisma-role-permission-matrix.repository.ts` |
| | `infrastructure/persistence/system-roles-seeder.ts` |
| Presentación | `presentation/http/admin.controller.ts` |
| | `presentation/http/me-permissions.controller.ts` |

### Módulo authorization (`apps/api/src/modules/authorization/`)

| Capa | Ruta |
|---|---|
| Servicio | `matrix-authorization.service.ts` |
| Módulo | `authorization.module.ts` |

---

## Pruebas

### Specs unitarias — módulo admin

| Archivo | Cubre |
|---|---|
| `application/commands/role-handlers.spec.ts` | create-role, deactivate-role, rename-role handlers |
| `application/commands/save-role-permission-matrix.handler.spec.ts` | SaveRolePermissionMatrixHandler |
| `application/commands/assign-user-to-company.handler.spec.ts` | AssignUserToCompanyHandler |
| `application/commands/deactivate-assignment.handler.spec.ts` | DeactivateAssignmentHandler |
| `application/queries/role-queries.handlers.spec.ts` | list-roles, get-role-permission-matrix, get-my-permissions |
| `application/queries/list-organization-users.handler.spec.ts` | ListOrganizationUsersHandler |
| `application/queries/get-organization-companies.handler.spec.ts` | GetOrganizationCompaniesHandler |
| `application/queries/get-role-permission-matrix.handler.spec.ts` | GetRolePermissionMatrixHandler |
| `application/services/admin-matrix-authorization.service.spec.ts` | AdminMatrixAuthorizationService |
| `application/services/matrix-scope.service.spec.ts` | MatrixScopeService |
| `application/services/administrator-guard.service.spec.ts` | AdministratorGuardService |
| `domain/matrix-resolution.spec.ts` | Lógica de resolución sede > empresa > organización |
| `domain/default-role-permission-matrix.spec.ts` | Matriz por defecto de roles de sistema |
| `domain/role-name.spec.ts` | Validación de nombre de rol |
| `presentation/http/admin-openapi.contract.spec.ts` | Contrato admin.yaml vs controller vs DTOs |

### Specs unitarias — módulo authorization

| Archivo | Cubre |
|---|---|
| `authorization/matrix-authorization.service.spec.ts` | MatrixAuthorizationService |

### Prueba de migración

| Archivo | Tipo |
|---|---|
| `apps/api/test/migrations/roles-upgrade.test.sh` | Migración upgrade (expand/backfill/contract) |

---

## Evidencia

- Ver `artifacts/evidence/admin/PR58-evidence.md`

---

## Notas

- No aplica UX-ID / PROTO-ID: este slice es exclusivamente backend (API + migración).
- Las columnas enum `role` en `user_company_assignments` quedan DEPRECADAS (nullable) y se retiran en un PR posterior (ROLES-DIN-01).
- Los módulos Devoluciones, Clientes y Flota siguen con sets hard-coded contra `roleKey` hasta la fase 4 (ROLES-DIN-03).
- El coupling de `MatrixAuthorizationService` hacia `admin/domain` es una excepción documentada (SEC-E2-EXT-001) — diseño intencional para que el servicio de autorización genérico tenga acceso directo al puerto y funciones de resolución de la matriz de roles específica.
