# Trazabilidad — Módulo Search (UC-BUS-001)

**Slice:** Búsqueda Global — búsqueda unificada de entidades por término libre  
**Branch:** `feature/phase-6-payments-reporting-search`  
**Fecha:** 2026-10-11

---

## Cadena de trazabilidad

```
BDD → SDD → TDD → OpenAPI → código → pruebas → evidencia
```

### BDD

| ID | Archivo | Módulo |
|---|---|---|
| BDD-BUS-001 | `docs/sources/bdd/bdd-10-busqueda-global.md` | Búsqueda Global |

### SDD

| ID | Archivo | Módulo |
|---|---|---|
| SDD-BUS-001 | `docs/sources/sdd/sdd-10-busqueda-global.md` | Búsqueda Global |

### TDD

| ID | Archivo | Módulo |
|---|---|---|
| TDD-BUS-001 | `docs/sources/tdd/tdd-10-busqueda-global.md` | Búsqueda Global |

### OpenAPI

| ID | Archivo | Versión |
|---|---|---|
| OPENAPI-SEARCH-V0.1.0 | `packages/contracts/openapi/search.yaml` | 0.1.0 |

---

## Casos de uso cubiertos

| UC | Descripción | Permiso |
|---|---|---|
| UC-BUS-001 | Búsqueda global por término libre en entidades activas del tenant | Basado en permisos de cada módulo |

### Reglas de negocio cubiertas

| BR | Descripción |
|---|---|
| BR-BUS-001 | El término debe tener al menos 2 caracteres |
| BR-BUS-002 | Aislamiento multiempresa: solo se buscan entidades del companyId del actor |
| BR-BUS-003 | Los resultados se agrupan por tipo de entidad |
| BR-BUS-004 | Cada grupo incluye máximo 5 resultados |
| BR-BUS-005 | La búsqueda es case-insensitive; usa pg_trgm para coincidencias aproximadas |
| BR-BUS-006 | Solo se muestran entidades a las que el actor tiene permiso de acceso |

### Tipos de entidad buscados

| Entidad | Módulo origen |
|---|---|
| Customers | Customers |
| Vehicles | Fleet |
| Rentals | Rentals |
| Reservations | Reservations |
| VehicleReturns | Returns |

---

## Código implementado

| Capa | Ruta |
|---|---|
| Módulo | `apps/api/src/modules/search/` |
| Controller | `apps/api/src/modules/search/presentation/http/search.controller.ts` |
| Query/Handler | `apps/api/src/modules/search/application/queries/global-search.handler.ts` |
| Domain | `apps/api/src/modules/search/domain/` |
| DTOs | `apps/api/src/modules/search/presentation/http/dto/` |

### Endpoints implementados

| Método | Ruta | Handler |
|---|---|---|
| GET | `/search?q=&companyId=&branchId=` | `GlobalSearchHandler` |

---

## Pruebas

| Tipo | Ruta | Estado |
|---|---|---|
| Unitarias (multitenancy, q<2, max-5, permisos) | `apps/api/src/modules/search/application/queries/global-search.handler.spec.ts` | ✅ 9/9 passing |

### Invariantes cubiertas

| Invariante | Test | Estado |
|---|---|---|
| P0 Multitenancy (BR-BUS-002) | `operatingCompanyId` en cada WHERE | ✅ |
| BR-BUS-001 longitud mínima | Graceful con q='a' y whitespace | ✅ |
| BR-BUS-005 máx 5/grupo | `take: limit` pasado a findMany | ✅ |
| BR-BUS-003 denegación por defecto | ForbiddenException sin permisos | ✅ |
| Permisos parciales | Solo entidades permitidas consultadas | ✅ |

**Nota:** El handler delega la validación de longitud mínima al DTO/controller. Si esa capa se omite, el handler ejecutaría queries para términos de 1 carácter. Documentado en el test.

---

## Evidencia

- Módulo NestJS: `apps/api/src/modules/search/search.module.ts`
- Contrato OpenAPI: `packages/contracts/openapi/search.yaml` v0.1.0
- Migración pg_trgm: `prisma/migrations/YYYYMMDD_add_pg_trgm_extension/migration.sql` (requiere aplicación manual con psql)
- TypeScript: 0 errores
- Lint: 0 errores

---

## Riesgos y pendientes

| Item | Estado |
|---|---|
| Migración pg_trgm | Requiere `psql` manual — no ejecutable vía Prisma en transacción |
| Tests de integración contra DB con pg_trgm | Pendiente — unitarios cubren lógica de filtrado |
