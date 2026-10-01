# Plan de implementación — pendientes backend KAIROS/VeloxRent (24 sep 2026)

Consolida lo pendiente en `erp-monolithic-api` tras el cierre de la cadena de merges del backend. A diferencia del frontend, el backend **no tiene un bloque de merges pendiente** — lo que queda es backlog funcional y mantenimiento de dependencias.

Documento equivalente para el frontend: `../erp-portal-web/docs/plan-implementacion-pendientes-2026-09-24.md`.

Última actualización: 01-oct-2026 (TR-07 mergeado PR#38; BDD/SDD/TDD notifications+fleet creados; 8 TDD transversales aprobados; PROP-001 confirmado).

---

## Estado actual de `main` (25-sep-2026)

- Cadena completa mergeada: HU-20 en adelante, incluyendo HU-27/Reserva (PR#6), Admin + TR-07 (PR#7), normalización de nombres BDD/SDD/TDD (PR#15) y plan de pendientes (PR#16).
- No hay ramas de backend pendientes de mergear.
- 7 PRs de Dependabot abiertos (ver Bloque 1 a continuación).

---

## Bloque 1 — Dependabot PRs (dependencias) ✅ CERRADO

| PR | Bump | Estado |
|----|------|--------|
| #8  | `actions/checkout` 4.2.2 → 7.0.1 | ✅ Mergeado 25-sep-2026 |
| #9  | `actions/setup-node` 4.4.0 → 7.0.0 | ✅ Mergeado 25-sep-2026 |
| #10 | `class-validator` 0.14.4 → 0.15.1 | ✅ Mergeado 25-sep-2026 |
| #11 | `@nestjs/testing` 10.4.22 → 12.0.4 | ❌ Cerrado — migración coordinada requerida |
| #12 | `@nestjs/config` 3.3.0 → 12.0.0 | ❌ Cerrado — migración coordinada requerida |
| #13 | `@nestjs/platform-express` 10.4.22 → 12.0.4 | ❌ Cerrado — migración coordinada requerida |
| #14 | `@nestjs/common` 10.4.22 → 12.0.4 | ❌ Cerrado — migración coordinada requerida |

Los PRs #11–#14 (NestJS 10→12) fueron cerrados porque los merges individuales fallan por:
1. **Dual-version en npm workspace** — TypeScript ve dos instancias de `DynamicModule` incompatibles (TS2322).
2. **ESM-only en Jest** — `@nestjs/common` v12 arrastra `file-type` v22 y `load-esm` (ESM-only); Jest en CommonJS no puede procesarlos.

La migración NestJS 10→12 debe hacerse como unidad coordinada. Ver issue [#17](https://github.com/kairosdesarrollotec-ai/erp-monolithic-api/issues/17).

---

## Bloque CI-A — Contract tests OpenAPI ✅ CERRADO

- [x] `reservations-openapi.contract.spec.ts`: 8 tests — rutas, códigos HTTP (skip deprecated), IdempotencyInterceptor en todos los POST, If-Match/428/412 en comandos, 3 DTOs, límites paginación, 2 enums Prisma, forma del mapper (commit incluido en PR#18).
- [x] `admin-openapi.contract.spec.ts`: 6 tests — rutas, códigos HTTP, 4 DTOs, 3 enums (commit incluido en PR#18).
- [x] `transversal-openapi.contract.spec.ts`: 5 tests — rutas de AuditController + UsersController, códigos HTTP, 2 DTOs, WorkerRole enum. Nota: `notifications.yaml` faltante → STOP `MISSING_API_CONTRACT` pendiente (commit incluido en PR#18).
- [x] Fix real detectado por los tests: `@HttpCode(200)` faltaba en 3 comandos POST de `ReservationsController` (register-payment, register-documents, confirm) que NestJS devolvía 201 en vez de 200 (commit incluido en PR#18).
- [x] PR#18 mergeado a `main` (25-sep-2026), CI verde.

---

## Bloque 2 — Backlog funcional pendiente

1. **ADM-02 — extender el enforcement de roles real más allá de Admin.**
   Hoy `AdminMatrixAuthorizationService` aplica la matriz real de roles solo al módulo ADMIN (decisión `PROP-004` en `decision-log.md`; `WorkerRole` provisional). Falta:
   - Extender el mismo enforcement a Reservations, Inquiries, Dashboard y Notifications.
   - Migrar el `WorkerRole` provisional al modelo de roles real donde aplique.
   - Coordinar con frontend el impacto en permisos/UI una vez implementado.

2. **TR-07 — envío externo real de notificaciones (email/push/SMS).** ✅ Mergeado PR#38 — 2026-10-01
   - Módulo autónomo `NotificationDispatchModule` desacoplado de Users/Notifications.
   - Puertos: `NotificationDispatcherPort`, `RecipientContactLookupPort`, `EmailNotificationPort`, `PushNotificationPort`, `SmsNotificationPort`.
   - Adaptadores: `FirebaseRecipientContactLookupAdapter` (real), `FirebasePushNotificationAdapter` (FCM real), `ConsoleEmailNotificationAdapter` (stub fase 2), `ConsoleSmsNotificationAdapter` (stub fase 2).
   - Integrado en `OutboxRelayService` con ejecución paralela de canales y contención de fallos sin abortar el relay ni envenenar la DLQ.
   - BDD/SDD/TDD específicos creados (2026-10-01); evidencia en `artifacts/evidence/notifications/TR-07-evidence.md`.
   - Deuda residual: adaptadores SMTP y Twilio (email/SMS reales) — fase 2.

3. **TR-04, TR-08, TR-09, TR-10** ("Transversal restante", HU-38) — sin empezar.
   - Revisar BDD/SDD/TDD transversales y contratos en `PANTALLAS-V3-B-TRANSVERSAL.md` para determinar qué parte requiere endpoint o lógica de backend (algunos pueden ser solo frontend).

4. **Migración NestJS 10 → 12** — issue [#17](https://github.com/kairosdesarrollotec-ai/erp-monolithic-api/issues/17). Requiere:
   - Actualizar todos los paquetes NestJS en un único commit (`@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`, `@nestjs/config`, `@nestjs/testing`).
   - Resolver ESM en Jest (`transformIgnorePatterns` o `--experimental-vm-modules`).
   - Verificar breaking changes en APIs usadas (`ModuleRef`, `HttpException`, `ValidationPipe`).
   - Registrar decisión formal en `docs/decision-log.md` (exigido por CLAUDE.md sección 7).

5. **Confirmar `npx prisma migrate deploy`** — verificar que las migraciones quedaron aplicadas correctamente en el entorno local tras el incidente de `migrate dev` de la sesión anterior. Verificación rápida, no bloquea nada.

---

## Conflictos abiertos

| Archivo | Descripción | Pendiente de |
|---------|-------------|-------------|
| `docs/conflicts/CONFLICT-CON-001.md` | `POST /reservations` vs. `convert-to-reservation` como único camino | Decisión de Eder Ramos (Tech Lead) → `decision-log.md` |
| `docs/conflicts/CONFLICT-CON-002.md` | Snapshot CON-02 en `inquiries` vs. futuro módulo Customers | Decisión de Eder Ramos (Tech Lead) → `decision-log.md` + actualización TDD-CON-001 |

Ambos conflictos tienen implementación interina aplicada en `main` (no bloquean desarrollo activo).

---

## Resumen

| # | Item | Estado | Depende de | Bloquea a |
|---|------|--------|-----------|-----------|
| 1 | Dependabot PRs (#8–#10 mergeados; #11–#14 cerrados → issue #17) | ✅ Cerrado | — | — |
| CI-A | Contract tests OpenAPI: Reservations, Admin, Transversal (PR#18) | ✅ Cerrado | — | — |
| CI-B.3 | SBOM CycloneDX en CI (PR#19) | ✅ Cerrado | — | — |
| CI-C | CD pipeline: Docker, Cloud Run, Prisma migrate deploy (PR#20) | ✅ Mergeado 25-sep-2026 | Setup GCP + secrets | — |
| 2 | ADM-02 — enforcement extendido | Pendiente | — | Parte frontend de ADM-02 |
| 3 | TR-07 — envío externo real | ✅ Mergeado PR#38 — 2026-10-01 | — | Fase 2: SMTP/Twilio (email/SMS reales) |
| 4 | Migración NestJS 10→12 (issue #17) | Pendiente | Decisión formal | — |
| 5 | TR-04/08/09/10 | Pendiente | Definir alcance backend vs. frontend | — |
| 6 | Confirmar `prisma migrate deploy` | Pendiente | — | — |
