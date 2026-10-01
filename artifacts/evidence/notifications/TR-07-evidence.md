# Evidencia — TR-07 NotificationDispatchModule

**Fecha:** 2026-10-01  
**Módulo:** `notifications` (despacho externo)  
**Trazabilidad:** [TR-07-dispatch.md](../../traceability/notifications/TR-07-dispatch.md)

---

## 1. Tests ejecutados

### Suite: `notification-dispatcher.service.spec.ts`

| Test | Estado |
|------|--------|
| retorna ALL_SKIPPED de inmediato si la lista de canales está vacía | ✅ PASS |
| despacha a todos los canales configurados en paralelo cuando los contactos existen | ✅ PASS |
| omite EMAIL si el usuario no tiene email configurado | ✅ PASS |
| omite PUSH si el usuario no tiene tokens registrados | ✅ PASS |
| omite SMS si el usuario no tiene teléfono registrado | ✅ PASS |
| contiene excepciones por canal para que no afecten a otros canales | ✅ PASS |
| degrada con elegancia si la resolución de contacto lanza una excepción | ✅ PASS |
| marca canal desconocido como SKIPPED con razón UNKNOWN_CHANNEL_* | ✅ PASS |

**Resultado:** 8/8 tests passing.

### Suite: `console-email-notification.adapter.spec.ts`

Adaptador EMAIL (stub de consola): PASS.

### Suite: `console-sms-notification.adapter.spec.ts`

Adaptador SMS (stub de consola): PASS.

### Suite: `firebase-recipient-contact-lookup.adapter.spec.ts`

| Test | Estado |
|------|--------|
| resuelve contacto completo con email, teléfono y tokens FCM (array) | ✅ PASS |
| resuelve contacto con fcmToken individual en customClaims | ✅ PASS |
| retorna null y no propaga error si Firebase Auth lanza excepción | ✅ PASS |

**Resultado:** 3/3 tests passing. Resuelto 2026-10-01 — stubs TypeScript vía `moduleNameMapper`.

### Suite: `firebase-push-notification.adapter.spec.ts`

| Test | Estado |
|------|--------|
| omite el envío con SKIPPED si el destinatario no tiene tokens FCM | ✅ PASS |
| despacha multicast y retorna DELIVERED con token enmascarado cuando el envío tiene éxito | ✅ PASS |
| retorna FAILED si todos los tokens del lote fallan | ✅ PASS |
| captura excepciones críticas de FCM retornando FAILED sin lanzar error | ✅ PASS |

**Resultado:** 4/4 tests passing. Resuelto 2026-10-01 — stubs TypeScript vía `moduleNameMapper`.

### Suites relacionadas por integración

| Suite | Estado |
|-------|--------|
| `outbox-relay.service.spec.ts` | ✅ PASS |
| `get-my-notifications.handler.spec.ts` | ✅ PASS |
| `mark-all-notifications-read.handler.spec.ts` | ✅ PASS |
| `notification-event-projector.spec.ts` | ✅ PASS |
| `notification-template-renderer.spec.ts` | ✅ PASS |

---

## 2. Comando de ejecución

```bash
# Desde kairos_space/
cd apps/erp-monolithic-api
npm run test:api -- --no-coverage
# Resultado: 430/430 passed, 86/86 suites (2026-10-01)
```

---

## 3. Cobertura de reglas de negocio

| Regla (BDD-TRANSVERSAL §TR-07) | Test que la cubre |
|--------------------------------|-------------------|
| Canal vacío → ALL_SKIPPED sin llamar contacto | `retorna ALL_SKIPPED de inmediato...` |
| Fallo de contactLookup → degradación, no excepción | `degrada con elegancia...` |
| Email faltante → SKIPPED RECIPIENT_EMAIL_NOT_CONFIGURED | `omite EMAIL si...` |
| Push sin tokens → SKIPPED RECIPIENT_PUSH_TOKEN_NOT_CONFIGURED | `omite PUSH si...` |
| SMS sin teléfono → SKIPPED RECIPIENT_PHONE_NOT_CONFIGURED | `omite SMS si...` |
| Excepción por canal → FAILED, no aborta otros canales | `contiene excepciones por canal...` |
| Canal desconocido → SKIPPED UNKNOWN_CHANNEL_* | `marca canal desconocido...` |
| Despacho paralelo completo → ALL_DELIVERED | `despacha a todos los canales...` |

---

## 4. Brechas conocidas (ver TR-07-dispatch.md)

| ID | Descripción | Impacto |
|----|-------------|---------|
| GAP-TR07-01 | No hay BDD/SDD/TDD específico del módulo | P1 — Solo fuentes transversales |
| GAP-TR07-02 | `RecipientContactLookupPort` sin `organizationId` original | **Resuelto 2026-10-01** — se agregó parámetro |
| GAP-TR07-03 | `NotificationChannel` acoplado cross-module | **Resuelto 2026-10-01** — movido a `common/domain/` |
| GAP-TR07-04 | Suite firebase adaptadores bloqueada por jest-esm-globals | **Resuelto 2026-10-01** — stubs TS vía moduleNameMapper |
| GAP-TR07-05 | Sin test de canal desconocido | **Resuelto 2026-10-01** — test agregado |

---

## 5. Diferencias aprobadas

- Stub de consola para EMAIL y SMS: documentado en PROP-009 (`docs/decision-log.md`).
- Firebase FCM real para PUSH: implementación productiva completa.
