# apps/api - KAIROS ERP Backend

Stack (ver `.claude/rules/backend/stack.md`): Node 22, TypeScript, NestJS, Prisma, PostgreSQL, Firebase Auth, Cloud Tasks, OpenAPI versionado.

## Estado actual
Scaffold inicial (branch `86e38x5kr_bootstrap-back`): estructura de carpetas por modulo, modulo `health`, y schema Prisma con las 4 tablas transversales compartidas (`idempotency_keys`, `outbox_events`, `audit_events`, `vehicle_commitments`) segun TDD-KAIROS-TRANSVERSAL.md 7.3-7.4. Sin logica de negocio todavia.

## Antes de correr

```bash
npm install
cp .env.example .env   # completar DATABASE_URL real
npx prisma migrate dev --name init_transversal
npm run start:dev
```

## Estructura (TDD-KAIROS-TRANSVERSAL.md seccion 6)

```
src/modules/{inquiries,reservations,rentals,returns,recruitment,hr-administration,
             customers,fleet,payments,evidence,notifications,audit}
```
Cada modulo nuevo se agrega pantalla a pantalla, respetando `presentation -> application -> domain`, limite de ~300 lineas por archivo (excepcion 500 con justificacion, TDD 6.2), y contrato OpenAPI propio en `packages/contracts/openapi/<modulo>.yaml` antes de implementar el endpoint.
