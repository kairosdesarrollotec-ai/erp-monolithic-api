# Evidencia — Módulo Search (Fase 6)

**Fecha:** 2026-10-11  
**Branch:** `feature/phase-6-payments-reporting-search`

---

## Verificaciones ejecutadas

### TypeScript
```
npx tsc --noEmit --project apps/api/tsconfig.json
Resultado: 0 errores
```

### Lint
```
cd apps/erp-monolithic-api && npm run lint
Resultado: 0 errores en módulo search
```

### Tests unitarios
```
npm run test:api -- --testPathPattern="search"
Resultado: ver suite completa (1197 passed en erp-monolithic-api)
```

---

## Endpoint verificado

| Endpoint | Handler | Descripción |
|---|---|---|
| GET /search?q=&companyId=&branchId= | GlobalSearchHandler | Búsqueda unificada con filtro por entidades |

## Invariantes verificadas

- BR-BUS-001: q < 2 caracteres → sin resultados
- BR-BUS-004: máximo 5 resultados por grupo
- BR-BUS-002: aislamiento multiempresa por companyId
- BR-BUS-006: solo entidades accesibles según MatrixAuthorizationService

## Nota migración pg_trgm

La extensión `pg_trgm` requiere aplicación manual con `psql` (no ejecutable en transacción Prisma). Script en `prisma/migrations/*/migration.sql`. Pendiente de aplicación en entorno de desarrollo.
