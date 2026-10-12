# TDD — 10 Búsqueda Global

# Technical Design Document — Búsqueda Global

**Código:** TDD-KAIROS-MVP-BUS-001 **Versión:** 1.0 (creado 11-oct-2026 — base usable inicial) **Estado:** DRAFT **Entradas:** `BDD-BUS-001`, `SDD-BUS-001` **Dominio:** Search (transversal) **Fecha:** 11 de octubre de 2026

---

## 1. Objetivo técnico

Implementar búsqueda global transversal con resultado en < 500 ms para queries típicas, sin tablas nuevas, respetando aislamiento multiempresa y permisos de módulo.

---

## 2. Fuentes de datos (solo lectura sobre tablas existentes)

| Grupo | Tabla principal | Campos buscables | Índice recomendado |
| --- | --- | --- | --- |
| Alquileres | `rentals` JOIN `customers` JOIN `vehicles` | `code`, `customer.full_name`, `vehicle.plate` | `pg_trgm` en `code`, `plate` |
| Reservas | `reservations` JOIN `customers` JOIN `vehicles` | `code`, `customer.full_name`, `vehicle.plate` | `pg_trgm` |
| Clientes | `customers` | `full_name`, `document_number`, `email` | `pg_trgm` en `full_name`, `document_number` |
| Vehículos | `vehicles` | `plate`, `brand`, `model` | `pg_trgm` en `plate` |
| Devoluciones | `returns` JOIN `rentals` JOIN `customers` | `code`, `customer.full_name` | `pg_trgm` |

> La extensión `pg_trgm` está disponible en PostgreSQL y habilita índices GIN sobre campos de texto para `ILIKE '%...%'` eficiente. Requiere migración `CREATE EXTENSION IF NOT EXISTS pg_trgm;` y los índices `CREATE INDEX CONCURRENTLY` (no bloquea lecturas).

---

## 3. Migración necesaria (solo índices, no tablas nuevas)

```sql
-- Migración: search-indexes
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rentals_code_trgm 
  ON rentals USING GIN (code gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vehicles_plate_trgm 
  ON vehicles USING GIN (plate gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_fullname_trgm 
  ON customers USING GIN (full_name gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_docnumber_trgm 
  ON customers USING GIN (document_number gin_trgm_ops);
```

> Los índices `CONCURRENTLY` son seguros en producción — no bloquean lecturas ni escrituras durante su creación.

---

## 4. Arquitectura del módulo

```
modules/search/
  domain/
    search-result.entity.ts          # { type, id, title, subtitle, route }
    ports/
      search.repository.ts           # Puerto: searchEntities(q, ctx) → SearchResult[]
  application/
    queries/
      global-search.query.ts
  infrastructure/
    prisma-search.repository.ts      # 5 queries en paralelo (Promise.all)
  presentation/
    search.controller.ts
    dto/
      search-query.dto.ts            # @IsString @MinLength(2) @MaxLength(100)
      search-results.dto.ts          # { groups: { type, label, results[] }[] }
  search.module.ts
```

---

## 5. Requisitos trazados

| BDD | SDD | Realización TDD |
| --- | --- | --- |
| BR-BUS-001 / BUS-P02 | UC-BUS-001 | `SearchQueryDto @MinLength(2)` |
| BR-BUS-002 / BR-BUS-003 | UC-BUS-001 | `PrismaSearchRepository` filtra por `companyId` + permisos |
| BR-BUS-004 | Frontend | `useDebounce(300)` en `useGlobalSearch.ts` |
| BR-BUS-005 | UC-BUS-001 | `LIMIT 5` en cada query |
| BR-BUS-007 | Todos los handlers | Solo `SELECT` — ningún comando de dominio |
| BR-BUS-008 | `PrismaSearchRepository` | Excluir campos biométricos/contraseñas de los campos `SELECT` |

---

## 6. Invariantes y pruebas requeridas

| Tipo | Descripción | Obligatorio |
| --- | --- | --- |
| Unitario | `SearchQueryDto` rechaza query < 2 chars | Sí |
| Integración | Búsqueda retorna máx. 5 por grupo sobre DB de prueba | Sí |
| Aislamiento | Actor empresa A no ve resultados de empresa B (P0) | Sí |
| Rendimiento | Query sobre 10k alquileres < 500 ms con índice trgm | Recomendado |
| Contrato | DTOs vs OpenAPI (cuando exista) | Cuando exista contrato |

---

## 7. Componente frontend reutilizable

El componente `GlobalSearch` debe:
- Ser autocontenido (`GlobalSearch/`) en `src/app/shared/`.
- No aceptar props de módulo específico — usa `useNavigate` internamente con las rutas de cada tipo de resultado.
- Ser accesible: `role="combobox"`, `aria-expanded`, `aria-autocomplete="list"`, `aria-activedescendant`.
- Cerrar con `Escape` y al click fuera (`useClickOutside` hook).
- Ser testeado con Testing Library + MSW (mock del endpoint `/search`).

---

## 8. Prototipos de referencia (aprobados 11-oct-2026)

| Proto ID | Estado | Viewport | Descripción |
| --- | --- | --- | --- |
| `PROTO-BUS-01-DROPDOWN-DESKTOP` | APPROVED | desktop | Dropdown con resultados agrupados |
| `PROTO-BUS-01-DROPDOWN-MOBILE` | APPROVED | mobile | Versión móvil del buscador |
| `PROTO-BUS-01-EMPTY-DESKTOP` | APPROVED | desktop | Estado sin resultados |
