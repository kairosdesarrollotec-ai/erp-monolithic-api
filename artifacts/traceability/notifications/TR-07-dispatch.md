# Trazabilidad — TR-07 Despachador de Notificaciones Externas

Generado: 2026-10-01  
Módulo: `notifications` / `dashboard-projections` (OutboxRelayService)  
Rama origen: `feature/bloque-2-tr-07-notificaciones-externas`  
Merge a main: 2026-10-01 (commit 2a86a95)

---

## Cadena BDD → SDD → TDD → código → pruebas

| Eslabón | Referencia | Estado | Nota |
|---------|-----------|--------|------|
| **BDD** | `BDD-KAIROS-MVP-002-TRANSVERSAL` §TR-07 (notificaciones externas) | `pending_review` | Cubre reglas de despacho de email, push y SMS por evento de dominio. No existe BDD-FLO ni BDD específico del módulo notifications; brecha documentada como P3. |
| **SDD** | `SDD-KAIROS-MVP-002-TRANSVERSAL` §16 (notificaciones) | `draft_pending_review` | Define canales EMAIL/PUSH/SMS, responsabilidades del despachador, política de reintentos y logging con PII masking. |
| **TDD** | `TDD-KAIROS-MVP-002-TRANSVERSAL` §notifications | `draft_pending_review` | Arquitectura hexagonal para el módulo; puertos abstractos; patrón Outbox (ADR-KAI-003); No existe TDD específico del módulo notifications (brecha P0 resuelta con PROP-009 en decision-log). |
| **OpenAPI** | No aplica — TR-07 es un módulo de infraestructura sin endpoints HTTP propios. Los eventos que lo activan llegan vía Outbox pattern desde `OutboxRelayService`. | — | — |
| **Código** | `apps/api/src/modules/notifications/` | Implementado | Ver detalle abajo |
| **Pruebas** | `notification-dispatcher.service.spec.ts` | Ejecutadas (estáticas — Node 26 en entorno) | 100% de ramas del switch; SKIPPED por canal sin contacto; FAILED por excepción; `ALL_SKIPPED` sin canales |
| **Evidencia** | `artifacts/evidence/notifications/` | ⚠️ Pendiente (P1) | Crear `TR-07-evidence.md` con resultados de ejecución real |

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
| GAP-TR07-01 | P2 | `NotificationChannel` importado desde `notification-templates/domain/` — acoplamiento cross-module. Debe moverse a `common/domain/`. | Pendiente |
| GAP-TR07-02 | P2 | `RecipientContactLookupPort.lookupContact()` no recibe `organizationId`. Brecha estructural de aislamiento multiempresa en la interfaz del puerto. | Pendiente |
| GAP-TR07-03 | P2 | Test spec no cubre canal desconocido (`UNKNOWN_CHANNEL_X`) aunque el switch lo maneja. | Pendiente |
| GAP-TR07-04 | P1 | Sin evidencia persistida en `artifacts/evidence/notifications/`. | Pendiente |
| GAP-TR07-05 | P3 | No existe BDD/SDD/TDD específico del módulo notifications; opera sobre fuentes transversales. | Documentado en PROP-009 |
