---
description: Stack backend inmutable y reglas de migraciones. Aplica a apps/api/**.
paths: ['apps/api/**']
---

# Stack backend obligatorio (apps/api/**)

Node.js 22, TypeScript, NestJS, Prisma, PostgreSQL, Firebase Authentication, Cloud Tasks (procesamiento asincrono cuando corresponda), contrato OpenAPI versionado.

Migraciones: revisables, reproducibles, compatibles con el modelo Prisma, seguras para datos existentes, reversibles cuando sea tecnicamente viable. No editar una migracion ya aplicada (crear forward-fix). No ejecutar `db push` contra ambientes compartidos o productivos. No ejecutar migraciones de produccion automaticamente.
