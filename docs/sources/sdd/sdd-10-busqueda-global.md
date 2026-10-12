# SDD — 10 Búsqueda Global

# Solution Design Document — Búsqueda Global

**Código:** SDD-KAIROS-MVP-BUS-001 **Versión:** 1.0 (creado 11-oct-2026 — base usable inicial) **Estado:** DRAFT **Entrada funcional:** `BDD-BUS-001` v1.0 **Depende de:** `SDD-KAIROS-TRANSVERSAL.md` **Alcance:** Componente de búsqueda transversal en el shell de la aplicación **Fecha:** 11 de octubre de 2026

---

## 1. Resumen ejecutivo

La búsqueda global es un **componente del shell** (topbar), no un módulo de dominio independiente. En el frontend es un componente React reutilizable (`GlobalSearch`) que vive en `src/app/shared/`. En el backend es un endpoint de solo lectura que agrega resultados de múltiples módulos, respetando los permisos del actor y el aislamiento multiempresa.

No requiere tablas nuevas — busca sobre los datos existentes de cada módulo.

---

## 2. Alcance

### 2.1 Incluido
- Búsqueda en: alquileres, reservas, clientes, vehículos, devoluciones.
- Resultados agrupados por tipo, hasta 5 por grupo.
- Debounce 300 ms, mínimo 2 caracteres.
- Aislamiento por `companyId` + `branchId` del actor.
- Filtrado por permisos del actor (`READ_LIST`/`READ_DETAIL` del módulo correspondiente).
- Estado vacío orientador.
- Navegación directa al detalle al seleccionar un resultado.

### 2.2 Excluido
- Indexación en motor externo (Elasticsearch, Typesense) — fuera del MVP.
- Búsqueda en módulos de RRHH (candidatos, vacantes) — OQ-BUS-002, pendiente.
- Búsqueda de incidencias y plantillas en v1 — ampliar en iteración siguiente.

---

## 3. Casos de uso

### UC-BUS-001 — Buscar entidades

**Actor:** Cualquier usuario autenticado  
**Trigger:** Usuario escribe ≥2 caracteres en el buscador global del topbar  
**Pasos:**
1. Frontend espera 300 ms (debounce).
2. Frontend envía `GET /search?q=<término>` con el token de sesión.
3. Backend valida el token y extrae `companyId`, `branchId`, permisos del actor.
4. Backend ejecuta queries en paralelo sobre cada entidad habilitada para el actor.
5. Backend filtra cada query con `WHERE companyId = :companyId`.
6. Backend retorna grupos de resultados ordenados por relevancia, máx. 5 por grupo.
7. Frontend muestra el dropdown con los resultados agrupados.
8. Al seleccionar: frontend navega a la ruta del detalle correspondiente.

**Postcondición:** Usuario en el detalle de la entidad seleccionada. No se modifica ningún estado.

---

## 4. Arquitectura

### Frontend

```
src/app/shared/
  GlobalSearch/
    GlobalSearch.tsx          # Componente de búsqueda (input + dropdown)
    GlobalSearch.module.css
    useGlobalSearch.ts        # Hook con debounce + llamada a /search
    SearchResultGroup.tsx     # Grupo de resultados por tipo
    SearchResultItem.tsx      # Ítem individual con ícono + texto
    GlobalSearch.test.tsx     # Tests de componente
```

- Se integra en el topbar existente (`AppShell` o equivalente).
- Usa `TanStack Query` con `enabled: query.length >= 2` para no ejecutar sin input válido.
- Usa `useDebounce(query, 300)` para limitar llamadas.
- Al seleccionar un resultado, usa `useNavigate()` de React Router con la ruta del detalle.

### Backend

```
modules/search/
  application/
    queries/
      global-search.query.ts
  infrastructure/
    prisma-search.repository.ts    # Queries sobre módulos existentes
  presentation/
    search.controller.ts
    dto/
      search-results.dto.ts
  search.module.ts
```

- `GET /search?q=<término>&limit=5` — sin paginación en v1 (máx. 5 por grupo).
- El módulo importa los repositorios de lectura de Rentals, Reservations, Customers, Fleet, Returns.
- Cada query usa `ILIKE '%:q%'` sobre los campos indexados — PostgreSQL trigram index (`pg_trgm`) recomendado para rendimiento (OQ-BUS-001).

---

## 5. OpenAPI (propuesta)

| Método | Ruta | Auth | Descripción |
| --- | --- | --- | --- |
| `GET` | `/search` | Bearer token | Búsqueda global; query param `q` (string, min 2 chars) |

> STOP `MISSING_API_CONTRACT`: el contrato OpenAPI formal no existe aún. No implementar frontend hasta formalizar.

---

## 6. Seguridad y multiempresa

- El endpoint valida el token Firebase en cada request.
- Cada query incluye `WHERE company_id = :companyId` (del token del actor).
- No se indexa ni retorna: passwords, tokens, biometría, documentos completos.
- El módulo `Search` no tiene permisos propios — respeta los permisos de cada módulo fuente.
