# Plan de implementación — pendientes backend KAIROS/VeloxRent (24 sep 2026)

Consolida lo pendiente en `erp-api-local` tras el cierre de la cadena de merges del backend (ya consolidada en `main`, PR#6 y PR#15). A diferencia del frontend, el backend **no tiene un bloque de merges pendiente** — lo que queda es backlog funcional.

Documento equivalente para el frontend: `erp-portal-web/docs/plan-implementacion-pendientes-2026-09-24.md`.

---

## Estado actual

- `main` tiene la cadena completa mergeada (HU-20 en adelante, incluyendo HU-27/Reserva vía PR#6, y la normalización de nombres de archivo BDD/SDD/TDD vía PR#15).
- No hay ramas de backend pendientes de mergear a la fecha de este plan.

---

## Backlog pendiente

1. **ADM-02 — extender el enforcement de roles real más allá de Admin.**
   Hoy `AdminMatrixAuthorizationService` aplica la matriz real de roles solo al módulo ADMIN (decisión explícita tomada de dejarlo para "siguiente paso", ver `decision-log.md`, PROP-004/`WorkerRole` provisional). Falta:
   - Extender el mismo enforcement a Reservations, Inquiries, Dashboard y Notifications.
   - Migrar el `WorkerRole` provisional al modelo de roles real donde aplique.
   - Coordinar con frontend el impacto en permisos/UI una vez implementado (ver Bloque 5 del plan frontend).

2. **TR-07 — envío externo real de notificaciones (email/push/SMS).**
   Hoy solo existe registro interno (`notifications` module) — el envío externo no está implementado.
   - Definir proveedor (SendGrid/SES para email, FCM para push, un proveedor SMS a definir).
   - Implementar el adaptador correspondiente respetando el contrato ya expuesto a frontend (evitar romper la UI actual de notificaciones).

3. **TR-04, TR-08, TR-09, TR-10** ("Transversal restante", HU-38) — sin empezar.
   - Revisar contratos en `PANTALLAS-V2-B-TRANSVERSAL.md` / `PANTALLAS-V3-B-TRANSVERSAL.md` y los TDD/SDD/BDD transversales para confirmar qué parte de cada uno requiere endpoint o lógica de backend (algunos podrían ser solo frontend).

4. **Confirmar `npx prisma migrate deploy`** — verificar que quedó aplicado correctamente en el entorno local tras el incidente de `migrate dev` de la sesión anterior. Verificación rápida, no bloquea nada.

---

## Resumen

| # | Item | Depende de | Bloquea a |
|---|------|-----------|-----------|
| 1 | ADM-02 — enforcement extendido | — | Parte frontend de ADM-02 |
| 2 | TR-07 — envío externo real | — | Parte frontend de TR-07 (si cambia el contrato) |
| 3 | TR-04/08/09/10 | Definir alcance backend vs. frontend | — |
| 4 | Confirmar `prisma migrate deploy` | — | — |

Ningún item de este backlog bloquea el Bloque 2 del plan frontend (merge de la cadena HU-22→HU-26), que es puramente frontend.
