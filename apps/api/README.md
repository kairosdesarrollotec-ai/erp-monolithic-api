# apps/api - KAIROS ERP Backend

Stack (ver `.claude/rules/backend/stack.md`): Node 22, TypeScript, NestJS, Prisma, PostgreSQL, Firebase Auth, Cloud Tasks, OpenAPI versionado.

## Estado actual
Scaffold inicial (branch `86e38x5kr_bootstrap-back`): estructura de carpetas por modulo, modulo `health`, schema Prisma con las 4 tablas transversales compartidas (`idempotency_keys`, `outbox_events`, `audit_events`, `vehicle_commitments`, TDD-KAIROS-TRANSVERSAL.md 7.3-7.4), inicializacion del Admin SDK de Firebase, y `docker-compose.yml` para Postgres local. Sin logica de negocio todavia.

## Antes de correr

```bash
docker compose up -d          # levanta Postgres local (docker-compose.yml en la raiz del repo)
npm install
cp .env.example .env          # completar DATABASE_URL / FIREBASE_* reales
npx prisma migrate dev --name init_transversal
npm run start:dev
```

### Sobre las variables de Firebase

El backend no distingue en codigo entre un proyecto Firebase de desarrollo y uno productivo: solo importa el valor de `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` en el `.env` local (gitignorado, nunca se commitea). Mientras no exista un proyecto Firebase de desarrollo propio, estas variables pueden apuntar directo al proyecto productivo - el mismo mecanismo sirve para migrar mas adelante sin tocar codigo.

Postgres corre en Docker localmente por ahora (`docker-compose.yml`); cuando el proyecto pase a un entorno real, se reemplaza `DATABASE_URL` por la de un Postgres gestionado, sin cambiar el schema de Prisma.

## Estructura (TDD-KAIROS-TRANSVERSAL.md seccion 6)

```
src/modules/{inquiries,reservations,rentals,returns,recruitment,hr-administration,
             customers,fleet,payments,evidence,notifications,audit}
```
Cada modulo nuevo se agrega pantalla a pantalla, respetando `presentation -> application -> domain`, limite de ~300 lineas por archivo (excepcion 500 con justificacion, TDD 6.2), y contrato OpenAPI propio en `packages/contracts/openapi/<modulo>.yaml` antes de implementar el endpoint.
