# Plan de implementación — pendientes backend KAIROS/VeloxRent (24 sep 2026)

Consolida lo pendiente en `erp-monolithic-api` tras el cierre de la cadena de merges del backend. A diferencia del frontend, el backend **no tiene un bloque de merges pendiente** — lo que queda es backlog funcional y mantenimiento de dependencias.

Documento equivalente para el frontend: `../erp-portal-web/docs/plan-implementacion-pendientes-2026-09-24.md`.

Última actualización: 25-sep-2026.

---

## Estado actual de `main` (25-sep-2026)

- Cadena completa mergeada: HU-20 en adelante, incluyendo HU-27/Reserva (PR#6), Admin + TR-07 (PR#7), normalización de nombres BDD/SDD/TDD (PR#15) y plan de pendientes (PR#16).
- No hay ramas de backend pendientes de mergear.
- 7 PRs de Dependabot abiertos (ver Bloque 1 a continuación).

---

## Bloque 1 — Dependabot PRs (dependencias) 🔄 EN PROGRESO

Los siguientes PRs de Dependabot están abiertos y requieren análisis antes de mergear:

| PR | Bump | Tipo | Riesgo |
|----|------|------|--------|
| #14 | `@nestjs/common` 10.4.22 → 12.0.4 | Runtime | ⚠️ Major — breaking changes NestJS 11/12 |
| #13 | `@nestjs/platform-express` 10.4.22 → 12.0.4 | Runtime | ⚠️ Major — breaking changes NestJS |
| #12 | `@nestjs/config` 3.3.0 → 12.0.0 | Runtime | ⚠️ Major — breaking changes NestJS |
| #11 | `@nestjs/testing` 10.4.22 → 12.0.4 | Dev | ⚠️ Major — solo pruebas |
| #10 | `class-validator` 0.14.4 → 0.15.1 | Runtime | Minor — revisar decoradores críticos |
| #9  | `actions/setup-node` 4.4.0 → 7.0.0 | CI | ⚠️ Major — revisar `.github/workflows/` |
| #8  | `actions/checkout` 4.2.2 → 7.0.1 | CI | ⚠️ Major — revisar `.github/workflows/` |

**Criterio de decisión:** los bumps de NestJS 10→12 requieren una decisión arquitectónica aprobada (CLAUDE.md sección 7: no cambiar versiones del stack sin autorización). Los de `actions/` son independientes del stack de producto y tienen menor riesgo. `class-validator` Minor puede evaluarse aisladamente.

**Orden de evaluación recomendado:**
1. `actions/checkout` + `actions/setup-node` — solo afectan CI, bajo riesgo de regresión en producción.
2. `class-validator` 0.14→0.15 — revisar changelog de decoradores usados (`@IsString`, `@IsEnum`, etc.).
3. NestJS 10→12 — evaluar migration guide oficial; requiere decisión formal antes de proceder.

---

## Bloque 2 — Backlog funcional pendiente

1. **ADM-02 — extender el enforcement de roles real más allá de Admin.**
   Hoy `AdminMatrixAuthorizationService` aplica la matriz real de roles solo al módulo ADMIN (decisión `PROP-004` en `decision-log.md`; `WorkerRole` provisional). Falta:
   - Extender el mismo enforcement a Reservations, Inquiries, Dashboard y Notifications.
   - Migrar el `WorkerRole` provisional al modelo de roles real donde aplique.
   - Coordinar con frontend el impacto en permisos/UI una vez implementado.

2. **TR-07 — envío externo real de notificaciones (email/push/SMS).**
   Hoy solo existe registro interno (`notifications` module) — el envío externo no está implementado.
   - Definir proveedor (SendGrid/SES para email, FCM para push, SMS a definir).
   - Implementar el adaptador respetando el contrato ya expuesto a frontend.

3. **TR-04, TR-08, TR-09, TR-10** ("Transversal restante", HU-38) — sin empezar.
   - Revisar BDD/SDD/TDD transversales y contratos en `PANTALLAS-V3-B-TRANSVERSAL.md` para determinar qué parte requiere endpoint o lógica de backend (algunos pueden ser solo frontend).

4. **Confirmar `npx prisma migrate deploy`** — verificar que las migraciones quedaron aplicadas correctamente en el entorno local tras el incidente de `migrate dev` de la sesión anterior. Verificación rápida, no bloquea nada.

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
| 1 | Dependabot PRs | 🔄 En progreso | — | — |
| 2 | ADM-02 — enforcement extendido | Pendiente | — | Parte frontend de ADM-02 |
| 3 | TR-07 — envío externo real | Pendiente | — | Parte frontend de TR-07 (si cambia contrato) |
| 4 | TR-04/08/09/10 | Pendiente | Definir alcance backend vs. frontend | — |
| 5 | Confirmar `prisma migrate deploy` | Pendiente | — | — |
