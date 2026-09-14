# Agentes Claude — Backend y Datos

## Catálogo obligatorio

| Agente | Herramientas | Puede escribir | Entregable/gate |
|---|---|---|---|
| `backend-slice-planner` | Read, Grep, Glob, índice | No | Plan trazado por BR/UC/TDD |
| `domain-modeler` | Read/Edit, tests | `domain`, `application` | Agregados, VO, invariantes, comandos |
| `database-migration-engineer` | Read/Edit, DB efímera | Prisma/SQL/migrations | Migración forward, constraints, RLS |
| `api-contract-engineer` | Read/Edit, OpenAPI tools | `packages/contracts` | OpenAPI 3.1 y tipos generados |
| `nest-module-implementer` | Read/Edit, test | Módulo asignado | Adaptadores NestJS y handlers |
| `integration-outbox-engineer` | Read/Edit, test | outbox/Cloud Tasks | Eventos, reintentos, DLQ |
| `backend-security-reviewer` | Solo lectura/test | Reporte | AuthN/AuthZ, tenant, ASVS/API Top 10 |
| `backend-test-engineer` | Read/Edit tests | Solo tests/fixtures | Unit/integración/contract/E2E/concurrencia |
| `migration-reviewer` | Solo lectura/DB test | Reporte | Locks, integridad, datos, recovery |
| `backend-release-gatekeeper` | Solo lectura/commands | Reporte | Veredicto final independiente |

## Límites por agente

### `backend-slice-planner`

- Lee BDD, SDD y TDD del módulo, además de Transversal y trazabilidad.
- Produce el task brief, dependencias, orden migración→contrato→código→prueba.
- No diseña campos ni endpoints ausentes.

### `domain-modeler`

- Dominio sin NestJS, Prisma, HTTP ni Firebase.
- Estados cambian únicamente mediante comandos explícitos.
- Preserva invariantes: no solapamiento, idempotencia, solo-avance de riesgo y máximos de cascada.
- No accede a tablas de otro módulo.

### `database-migration-engineer`

- Prisma 7.10.0 y SQL explícito para `EXCLUDE`, partial unique indexes, checks, triggers/RLS cuando Prisma no los modele.
- Prohíbe `db push` en ambientes compartidos/productivos.
- No edita migraciones ya aplicadas; crea forward-fix.
- Prueba desde base vacía y desde snapshot representativo anonimizado.

### `api-contract-engineer`

- Contract-first; valida ejemplos, errores, scopes, idempotency y paginación.
- No permite `PATCH status` genérico.
- Versiona cambios breaking.
- Genera tipos; backend y frontend no duplican DTO manualmente.

### `nest-module-implementer`

- Implementa dentro de `apps/api/src/modules/<module>`.
- Respeta `presentation → application → domain`; infraestructura implementa puertos.
- Todo comando crítico valida tenant, autorización, precondiciones e idempotencia.

### `integration-outbox-engineer`

- Estado y outbox se escriben en la misma transacción.
- Cloud Tasks entrega side effects; consumidores idempotentes.
- Define retry, backoff, DLQ, replay y observabilidad sin PII.

### Revisores

- No corrigen silenciosamente el código revisado.
- Entregan severidad P0–P3, evidencia, regla vulnerada y prueba faltante.
- P0/P1 bloquea merge.

## Frontmatter base

```yaml
---
name: database-migration-engineer
description: Implementa y valida migraciones PostgreSQL/Prisma de KAIROS cuando un slice aprobado modifica persistencia.
tools: Read, Grep, Glob, Edit, Write, Bash
model: sonnet
permissionMode: default
skills:
  - kairos-source-preflight
  - kairos-postgres-migrations
---
```

El prompt interno debe exigir fuentes, allowed paths, ejecución de tests y STOP conditions. El `description` debe ser breve para no consumir contexto global.

## Asignación por módulo

Los agentes se invocan con un único módulo: `customers`, `fleet`, `inquiries`, `reservations`, `rentals`, `returns`, `payments`, `evidence`, `incidents`, `recruitment`, `hr-administration`, `notifications` o `audit`. Cambios multi-módulo requieren plan de puertos/eventos aprobado por `architecture-guardian`.
