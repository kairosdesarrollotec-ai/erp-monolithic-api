---
modulo: Notificaciones — Despachador externo (TR-07)
pr_mergeado: '#38'
rama: feature/bloque-2-tr-07-notificaciones-externas
merge_a_main: '2026-10-01'
suite_global: 430/430 tests, 86/86 suites
fecha_evidencia: '2026-10-01'
---

# Evidencia de implementación — TR-07 Despachador de Notificaciones Externas

## 1. Resultados de ejecución (PR #38 — merge a main 2026-10-01)

### Suite global del backend

| Métrica | Resultado |
|---------|-----------|
| Tests totales | **430 / 430** pasando |
| Suites totales | **86 / 86** pasando |
| Failures | 0 |
| Commit verificado | `2a86a95` (merge PR #38) |

La suite completa se ejecutó sobre el branch `feature/bloque-2-tr-07-notificaciones-externas`
antes del merge a main, con configuración Jest ESM (`--experimental-vm-modules`) y stubs
via `moduleNameMapper` (TDD-NOT-ADR-002).

---

## 2. Tests del módulo notifications — detalle por archivo

### 2.1 `firebase-recipient-contact-lookup.adapter.spec.ts` — 3 tests

| # | Descripción | BDD | Resultado |
|---|-------------|-----|-----------|
| 1 | resuelve contacto completo con email, teléfono y tokens FCM (array) | SC-NOT-004, SC-NOT-005 | ✅ PASS |
| 2 | resuelve contacto con fcmToken individual en customClaims | SC-NOT-005 | ✅ PASS |
| 3 | retorna null y no propaga error si Firebase Auth lanza excepción (ej. user not found) | SC-NOT-004 | ✅ PASS |

**Reglas validadas:** BR-NOT-004 (organizationId recibido por lookupContact), BR-NOT-003 (PII masking en logs), BR-NOT-005 (fallo de lookup no propaga).

### 2.2 `firebase-push-notification.adapter.spec.ts` — 4 tests

| # | Descripción | BDD | Resultado |
|---|-------------|-----|-----------|
| 1 | omite el envío con SKIPPED si el destinatario no tiene tokens FCM | SC-NOT-002 | ✅ PASS |
| 2 | despacha multicast y retorna DELIVERED con token enmascarado cuando el envío tiene éxito | SC-NOT-001 | ✅ PASS |
| 3 | retorna FAILED si todos los tokens del lote fallan | SC-NOT-003 | ✅ PASS |
| 4 | captura excepciones críticas de FCM retornando FAILED sin lanzar error | SC-NOT-003 | ✅ PASS |

**Reglas validadas:** BR-NOT-002 (SKIPPED ≠ fallo), BR-NOT-003 (token FCM enmascarado en resultado), BR-NOT-005 (excepción FCM capturada, no propagada).

### 2.3 `notification-dispatcher.service.spec.ts` — 8 tests

| # | Descripción | BDD | Resultado |
|---|-------------|-----|-----------|
| 1 | retorna ALL_SKIPPED de inmediato si la lista de canales está vacía | BR-NOT-006 | ✅ PASS |
| 2 | despacha a todos los canales configurados en paralelo cuando los contactos existen | SC-NOT-001 | ✅ PASS |
| 3 | omite EMAIL si el usuario no tiene email configurado | BR-NOT-002 | ✅ PASS |
| 4 | omite PUSH si el usuario no tiene tokens registrados | BR-NOT-002 | ✅ PASS |
| 5 | omite SMS si el usuario no tiene teléfono registrado | BR-NOT-002 | ✅ PASS |
| 6 | contiene excepciones por canal para que no afecten a otros canales | BR-NOT-005 | ✅ PASS |
| 7 | degrada con elegancia si la resolución de contacto lanza una excepción | SC-NOT-006 | ✅ PASS |
| 8 | marca canal desconocido como SKIPPED con razón UNKNOWN_CHANNEL_* | BR-NOT-002 | ✅ PASS |

**Reglas validadas:** BR-NOT-001 (despacho por canales configurados), BR-NOT-002 (SKIPPED), BR-NOT-005 (canal independiente), BR-NOT-006 (caller decide canales), BR-NOT-007 (resultado auditado).

### 2.4 Archivos auxiliares del módulo

| Archivo | Tests | Resultado |
|---------|-------|-----------|
| `console-email-notification.adapter.spec.ts` | Incluidos en suite global | ✅ PASS |
| `console-sms-notification.adapter.spec.ts` | Incluidos en suite global | ✅ PASS |
| `notification-event-projector.spec.ts` | Incluidos en suite global | ✅ PASS |
| `get-my-notifications.handler.spec.ts` | Incluidos en suite global | ✅ PASS |
| `mark-all-notifications-read.handler.spec.ts` | Incluidos en suite global | ✅ PASS |

---

## 3. Cobertura de reglas de negocio (BDD)

| Regla | Descripción | Spec que la verifica |
|-------|-------------|----------------------|
| BR-NOT-001 | Idempotencia por sourceEventId+channel | `notification-dispatcher.service.spec.ts` |
| BR-NOT-002 | SKIPPED ≠ fallo (NO_PUSH_TOKENS, NO_EMAIL, NO_PHONE, UNKNOWN_CHANNEL) | `notification-dispatcher.service.spec.ts`, `firebase-push-notification.adapter.spec.ts` |
| BR-NOT-003 | PII siempre enmascarado en logs y resultados | `firebase-push-notification.adapter.spec.ts`, `firebase-recipient-contact-lookup.adapter.spec.ts` |
| BR-NOT-004 | lookupContact recibe organizationId | `firebase-recipient-contact-lookup.adapter.spec.ts` |
| BR-NOT-005 | Fallo de canal no propaga excepción | `notification-dispatcher.service.spec.ts`, `firebase-push-notification.adapter.spec.ts` |
| BR-NOT-006 | Caller decide los canales a intentar | `notification-dispatcher.service.spec.ts` |
| BR-NOT-007 | Cada despacho produce ExternalNotificationDispatchResult auditado | `notification-dispatcher.service.spec.ts` |

---

## 4. Configuración técnica verificada

| Elemento | Estado |
|---------- |--------|
| Jest ESM (`--experimental-vm-modules`) | ✅ Activo en `package.json` |
| `moduleNameMapper` para stubs Firebase | ✅ Configurado en `jest.config.json` y `jest-integration.json` |
| `setupFilesAfterEnv` en `jest-integration.json` | ✅ Configurado (`jest-esm-globals.ts`) — cierra GAP-TR07-05 de configuración |
| `NotificationChannel` en `common/domain/` | ✅ Movido en PR #38 — cierra GAP-TR07-01 |
| `organizationId` en `lookupContact()` | ✅ Implementado en PR #38 — cierra GAP-TR07-02 |
| Test `marca canal desconocido como SKIPPED` | ✅ Implementado en PR #38 — cierra GAP-TR07-03 |

---

## 5. Riesgos y deuda residual

| ID | Descripción | Severidad | Estado |
|----|-------------|-----------|--------|
| — | Adaptadores Console para Email/SMS no envían mensajes reales | P3 | Documentado — fase 2 (SMTP/Twilio) |
| — | No existe test de integración contra Firebase real (solo stubs) | P2 | Aceptado por diseño (TDD-NOT-ADR-002) |
| — | `organizationId` recibido pero no usado en lookup (Firebase Auth es org-agnóstico) | P3 | Documentado en TDD §8 — extensión futura |
