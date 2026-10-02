# Trazabilidad — TR-07 Despachador de Notificaciones Externas

Generado: 2026-10-01  
Actualizado: 2026-10-01 — BDD/SDD/TDD específicos creados; GAP-TR07-01..05 cerrados; evidencia registrada.  
Módulo: `notifications` / `dashboard-projections` (OutboxRelayService)  
Rama origen: `feature/bloque-2-tr-07-notificaciones-externas`  
Merge a main: 2026-10-01 (commit 2a86a95)

---

## Cadena BDD → SDD → TDD → código → pruebas

| Eslabón | Referencia | Estado | Nota |
|---------|-----------|--------|------|
| **BDD** | `docs/sources/bdd/bdd-notifications.md` v1.0 (BR-NOT-001..007, SC-NOT-001..006) | `approved` | BDD específico del módulo creado 2026-10-01. Cierra GAP-TR07-05. |
| **SDD** | `docs/sources/sdd/sdd-notifications.md` v1.0 | `approved` | SDD específico del módulo creado 2026-10-01. Cierra GAP-TR07-05. |
| **TDD** | `docs/sources/tdd/tdd-notifications.md` v1.0 (TDD-NOT-ADR-001..005) | `approved` | TDD específico del módulo creado 2026-10-01. Documenta stubs Jest ESM, NotificationChannel en common/domain, setupFilesAfterEnv. Cierra GAP-TR07-05. |
| **OpenAPI** | No aplica — TR-07 es un módulo de infraestructura sin endpoints HTTP propios. Los eventos que lo activan llegan vía Outbox pattern desde `OutboxRelayService`. | — | — |
| **Código** | `apps/api/src/modules/notifications/` | Implementado | Ver detalle abajo |
| **Pruebas** | 15 tests TR-07 específicos; 430/430 tests globales | Ejecutadas — PR #38, suite 86/86 suites ✅ | Ver `artifacts/evidence/notifications/TR-07-evidence.md` |
| **Evidencia** | `artifacts/evidence/notifications/TR-07-evidence.md` | ✅ Registrada (2026-10-01) | 430/430 tests, 86/86 suites; cobertura BR-NOT-001..007 |

---

## Archivos implementados

### Módulo principal
| Archivo | Tipo | Descripción |
|---------|------|-------------|
| `modules/notifications/notification-dispatch.module.ts` | NestJS Module | Registra puertos y adaptadores; exporta solo `NotificationDispatcherPort` |
| `modules/notifications/domain/external-notification.ts` | Domain | Tipos `RecipientContact`, `ChannelNotificationPayload`, `ChannelDeliveryResult`, `ExternalNotificationDispatchResult`; utilidades `computeOverallDeliveryStatus`, `maskEmail`, `maskPhoneNumber`, `maskPushToken` |
| `modules/notifications/application/ports/notification-dispatcher.port.ts` | Port (abstracto) | `DispatchNotificationInput`, `NotificationDispatcherPort` |
| `modules/notifications/application/ports/recipient-contact-lookup.port.ts` | Port (abstracto) | `RecipientContactLookupPort` |
| `modules/notifications/application/ports/channel-notification.port.ts` | Port (abstracto) | `EmailNotificationPort`, `PushNotificationPort`, `SmsNotificationPort` |
| `modules/notifications/application/services/notification-dispatcher.service.ts` | Service | Implementa `NotificationDispatcherPort`; despacha en paralelo EMAIL/PUSH/SMS; maneja SKIPPED y FAILED por canal sin afectar otros canales |
| `modules/notifications/infrastructure/adapters/firebase-recipient-contact-lookup.adapter.ts` | Adapter | Resuelve email/pushTokens/phoneNumber desde Firebase Admin |
| `modules/notifications/infrastructure/adapters/firebase-push-notification.adapter.ts` | Adapter | Envía push real vía Firebase FCM (sendMulticast) |
| `modules/notifications/infrastructure/adapters/console-email-notification.adapter.ts` | Adapter (stub) | Email stub — console.log; sin envío real |
| `modules/notifications/infrastructure/adapters/console-sms-notification.adapter.ts` | Adapter (stub) | SMS stub — console.log; sin envío real |

### Integración con Outbox
| Archivo | Cambio | Descripción |
|---------|--------|-------------|
| `modules/dashboard-projections/infrastructure/outbox-relay.service.ts` | Modificado | Inyecta `NotificationDispatcherPort`; llama `dispatch()` tras crear notificación interna si el template tiene canales configurados |
| `modules/dashboard-projections/dashboard-projections.module.ts` | Modificado | Importa `NotificationDispatchModule` |

---

## Reglas de negocio cubiertas

| Regla | Fuente | Implementación |
|-------|--------|----------------|
| Despachar en paralelo los canales configurados en el template | BDD-TRANSVERSAL §TR-07 | `Promise.all(deliveryPromises)` en `NotificationDispatcherService.dispatch()` |
| Si el destinatario no tiene email/push/phone → SKIPPED (no error) | BDD-TRANSVERSAL §TR-07 | `RECIPIENT_EMAIL_NOT_CONFIGURED`, `RECIPIENT_PUSH_TOKEN_NOT_CONFIGURED`, `RECIPIENT_PHONE_NOT_CONFIGURED` |
| Fallo en un canal no aborta los demás | BDD-TRANSVERSAL §TR-07 | try/catch por canal, resultado `FAILED` con `CHANNEL_EXCEPTION` |
| No registrar en logs PII innecesaria | CLAUDE.md §8 | `recipientFirebaseUid.slice(0, 6)...`; `maskEmail`; `maskPhoneNumber` |
| Fallo del despachador externo no aborta el procesamiento del outbox | ADR-KAI-003 | `OutboxRelayService.projectNotification()`: dispatch en try/catch independiente |

---

## Brechas conocidas y pendientes

| # | P | Descripción | Estado |
|---|---|-------------|--------|
| GAP-TR07-01 | P2 | `NotificationChannel` importado desde `notification-templates/domain/` — acoplamiento cross-module. | **Resuelto PR #38** — movido a `common/domain/notification-channel.ts` |
| GAP-TR07-02 | P2 | `RecipientContactLookupPort.lookupContact()` no recibe `organizationId`. | **Resuelto PR #38** — `organizationId` añadido al puerto y al adaptador Firebase; documentado en TDD-NOT-ADR-004 |
| GAP-TR07-03 | P2 | Test spec no cubre canal desconocido (`UNKNOWN_CHANNEL_X`). | **Resuelto PR #38** — test `"marca canal desconocido como SKIPPED con razón UNKNOWN_CHANNEL_*"` en `notification-dispatcher.service.spec.ts` |
| GAP-TR07-04 | P1 | Sin evidencia persistida en `artifacts/evidence/notifications/`. | **Resuelto 2026-10-01** — `artifacts/evidence/notifications/TR-07-evidence.md` creado |
| GAP-TR07-05 | P3 | No existe BDD/SDD/TDD específico del módulo notifications. | **Resuelto 2026-10-01** — bdd-notifications.md, sdd-notifications.md, tdd-notifications.md v1.0 creados |
