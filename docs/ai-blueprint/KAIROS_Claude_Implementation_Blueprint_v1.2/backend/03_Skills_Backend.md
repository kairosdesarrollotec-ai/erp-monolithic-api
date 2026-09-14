# Skills Claude — Backend y Datos

Cada skill es un directorio `.claude/skills/<nombre>/SKILL.md`. Debe contener un procedimiento reusable, referencias mínimas, scripts deterministas y criterios de STOP.

| Skill | Activación | Resultado |
|---|---|---|
| `kairos-source-preflight` | Antes de todo cambio | Task brief y fuentes vigentes |
| `kairos-domain-command` | Crear/modificar comando | Handler, invariantes y tests |
| `kairos-postgres-migrations` | Cambiar persistencia | Prisma/SQL, checks y reporte |
| `kairos-openapi-contract` | Crear/cambiar endpoint | Spec validada y tipos generados |
| `kairos-tenant-security` | Repositorio/endpoint nuevo | Policy y pruebas cross-tenant |
| `kairos-idempotency-concurrency` | Escritura crítica | Idempotencia, locking/constraint y tests |
| `kairos-outbox-cloud-tasks` | Side effect/evento | Outbox, schema, worker y replay |
| `kairos-evidence-upload` | Fotos/videos | URL temporal, metadata y lifecycle |
| `kairos-backend-testing` | Final de slice | Pirámide de pruebas y evidencia |
| `kairos-db-migration-review` | Antes de merge | Riesgo de locks/backfill/recovery |

## Contrato común de una skill

```yaml
---
name: kairos-openapi-contract
description: Crea o modifica contratos OpenAPI 3.1 de KAIROS a partir del TDD aprobado.
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
---
```

Contenido obligatorio:

1. Cuándo usar y cuándo no usar.
2. Inputs y fuentes obligatorias.
3. Allowed/forbidden paths.
4. Procedimiento paso a paso.
5. Validadores/scripts existentes que deben ejecutarse.
6. STOP conditions.
7. Entregables.
8. Checklist y formato de evidencia.

## Ejemplo de procedimiento: migración

1. Leer modelo físico y transacción del TDD del módulo.
2. Localizar objetos existentes con índice exacto/simbólico.
3. Comparar Prisma schema, SQL aplicado y base efímera.
4. Diseñar expansión compatible; separar backfill/constraint si corresponde.
5. Generar migración, sin editar historial.
6. Agregar SQL avanzado explícito.
7. Probar base vacía, upgrade, datos inválidos, concurrencia y rollback operativo/forward-fix.
8. Actualizar catálogo y evidencia.
9. Solicitar revisión independiente.

STOP: columnas históricas/transformaciones no definidas, pérdida de datos, lock no evaluado, acceso productivo o contradicción TDD.

## Scripts deterministas recomendados

- `scripts/validate-source-refs.ts`
- `scripts/check-module-boundaries.ts`
- `scripts/validate-openapi.ts`
- `scripts/generate-contract-types.ts`
- `scripts/verify-migrations.ts`
- `scripts/check-rls-coverage.sql`
- `scripts/check-traceability.ts`
- `scripts/scan-sensitive-logs.ts`

Claude invoca estos scripts; no recrea manualmente validaciones existentes.
