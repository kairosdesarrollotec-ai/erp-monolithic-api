---
modulo: Notificaciones
proceso: Despacho externo de notificaciones transversales
version: '1.1'
estado: APROBADO
fecha_aprobacion: '2026-10-02'
autores:
  - Russbel Hernández (BA)
  - Equipo técnico KAIROS
fuentes_base:
  - bdd-notifications.md v1.1
  - BDD-KAIROS-MVP-002-TRANSVERSAL §12
  - SDD-KAIROS-MVP-002-TRANSVERSAL §16
  - artifacts/traceability/notifications/TR-07-dispatch.md
---

## 0. Control de cambios

| Versión | Fecha | Autor | Cambio |
| --- | --- | --- | --- |
| 1.0 | 2026-10-01 | Russbel Hernández | Documento inicial — diseño funcional del módulo TR-07 implementado (430/430 tests). |
| 1.1 | 2026-10-02 | Equipo técnico KAIROS | Rectificación SOURCE_CONFLICT: incorpora la capa `presentation/` (NotificationsController, GetMyNotificationsHandler, MarkAllNotificationsReadHandler) que ya estaba implementada y activa. Alinea con bdd-notifications.md v1.1 y el contrato notifications.yaml v0.1.0. |

---

## 1. Control y gobernanza

| Campo | Valor |
| --- | --- |
| Dueño del módulo | Equipo técnico KAIROS |
| Revisado por | Russbel Hernández (BA) |
| Estado | APROBADO |
| BDD de referencia | bdd-notifications.md v1.1 |
| TDD de referencia | tdd-notifications.md v1.1 |
| Trazabilidad | artifacts/traceability/notifications/TR-07-dispatch.md |

---

## 2. Resumen ejecutivo

El módulo `notifications` implementa el **despacho externo transversal** del ERP KAIROS: cuando un evento de dominio publicado en el outbox requiere comunicarse con un actor externo (cliente, candidato, personal operativo), este módulo resuelve el destinatario, selecciona los canales apropiados y coordina los intentos de entrega.

El diseño sigue **arquitectura hexagonal**: el dominio y la aplicación son agnósticos de los proveedores de notificación. Los adaptadores concretos (Firebase FCM, console email/SMS) son intercambiables sin tocar la lógica de negocio.

Fase 1 del MVP implementa:
- Canal PUSH vía Firebase Cloud Messaging.
- Canales EMAIL y SMS vía adaptadores de consola (placeholder para producción).
- Resolución de contacto vía Firebase Authentication.

---

## 3. Alcance

### 3.1 Incluido

- Puerto de despacho (`NotificationDispatcherPort`) con su implementación (`NotificationDispatcherService`).
- Resolución del destinatario (`RecipientContactLookupPort`) vía Firebase Auth.
- Despacho PUSH (`PushNotificationPort`) vía Firebase FCM.
- Despacho EMAIL y SMS (`EmailSenderPort`, `SmsSenderPort`) vía consola (fase 1).
- Cálculo del estado agregado de entrega (`computeOverallDeliveryStatus`).
- Enmascaramiento de PII en resultados y logs.
- **Bandeja de notificaciones in-app** (TR-07): `GET /notifications` (consulta paginada por empresa/sede, filtro unreadOnly) y `POST /notifications/read-all` (marcado masivo). Contrato: `packages/contracts/openapi/notifications.yaml v0.1.0`.
- Proyección de eventos de dominio en notificaciones de lectura (`NotificationEventProjector`).

### 3.2 Excluido

- Renderizado del contenido — responsabilidad del módulo `notification-templates`.
- Enrutamiento y scheduling de eventos — responsabilidad del módulo `outbox`.
- Canal WhatsApp directo — implementado como SMS hasta integración proveedor.
- Reintentos automáticos con backoff — en la fase 1 el reintento es responsabilidad del `OutboxRelay`.
- Marcado individual de notificación como leída — solo marcado masivo por empresa/sede.
- Eliminación o archivado de notificaciones.

### 3.3 Dependencias hacia este módulo

| Módulo | Relación |
| --- | --- |
| `outbox` (OutboxRelay) | Llama a `NotificationDispatcherPort.dispatch()` por cada evento de outbox |
| `notification-templates` | Resuelve título y cuerpo antes de llamar al despachador |

### 3.4 Dependencias de este módulo

| Módulo / Servicio | Relación |
| --- | --- |
| Firebase Authentication | Resolución de datos de contacto por UID |
| Firebase Cloud Messaging | Despacho PUSH en producción |
| `common/domain/notification-channel` | Enum compartido NotificationChannel (EMAIL, SMS, PUSH) |

---

## 4. Drivers de diseño

| Driver | Descripción |
| --- | --- |
| Hexagonal (ports & adapters) | El dominio no importa Firebase, SMTP ni Twilio. Los adaptadores son intercambiables. |
| Resiliencia de canal | Un fallo en un canal no aborta el despacho a los demás canales. |
| PII-safe por diseño | Los identificadores de destinatario siempre se enmascaran antes de logear. |
| Testabilidad sin proveedor real | Los adaptadores de consola permiten ejecutar el ciclo completo en CI sin credenciales externas. |
| Multitenancy | `organizationId` está presente en cada despacho — soporte para contacto per-tenant en el futuro. |

---

## 5. Arquitectura de capas

```
presentation/http/
  notifications.controller.ts                     — @Controller('notifications'), @UseGuards(FirebaseAuthGuard)
  dto/
    get-my-notifications-query.dto.ts              — Query params: companyId, branchId, unreadOnly
    mark-all-notifications-read.dto.ts             — Body: companyId, branchId
    notification.response.ts                       — NotificationsResponse, NotificationItemResponse

application/
  commands/
    dispatch-notification.command.ts               — Caso de uso de despacho externo
    mark-all-notifications-read.command.ts         — Comando: marcar todas como leídas
    mark-all-notifications-read.handler.ts         — Handler del comando
  queries/
    get-my-notifications.query.ts                  — Query: listar notificaciones del usuario
    get-my-notifications.handler.ts                — Handler: delega a NotificationReadModelPort
  ports/
    notification-dispatcher.port.ts                — Puerto primario (entrada despacho)
    notification-read-model.port.ts                — Puerto CRUD del read model in-app
    email-sender.port.ts                           — Puerto secundario (salida EMAIL)
    push-notification.port.ts                      — Puerto secundario (salida PUSH)
    sms-sender.port.ts                             — Puerto secundario (salida SMS)
    recipient-contact-lookup.port.ts               — Puerto secundario (salida resolución contacto)

domain/
  external-notification.ts                        — Tipos: ChannelNotificationPayload,
                                                     ChannelDeliveryResult, OverallDeliveryStatus,
                                                     funciones mask*, computeOverallDeliveryStatus
  notification-event-projector.ts                 — Proyecta eventos de dominio en notificaciones
                                                     de lectura para la bandeja in-app

infrastructure/adapters/
  firebase-push-notification.adapter.ts           — Implementa PushNotificationPort (FCM)
  firebase-recipient-contact-lookup.adapter.ts    — Implementa RecipientContactLookupPort
  console-email-sender.adapter.ts                 — Implementa EmailSenderPort (fase 1)
  console-sms-sender.adapter.ts                   — Implementa SmsSenderPort (fase 1)
infrastructure/persistence/
  prisma-notification-read-model.repository.ts    — Implementa NotificationReadModelPort (Prisma)

notification-dispatch.module.ts                   — NestJS Module que ata puertos de despacho
notification-read-model.module.ts                 — NestJS Module del read model in-app
notifications.module.ts                           — NestJS Module raíz que importa los dos anteriores
```

---

## 6. Componentes

### 6.1 NotificationDispatcherPort / NotificationDispatcherService

**Responsabilidad:** Coordinar el despacho de una notificación a través de uno o más canales para un destinatario.

**Flujo:**
1. Recibe `DispatchNotificationInput` del llamador (`OutboxRelay`).
2. Invoca `RecipientContactLookupPort.lookupContact(uid, organizationId)`.
3. Si el contacto es `null`: retorna `ALL_SKIPPED` con reason `RECIPIENT_NOT_FOUND`.
4. Por cada canal en `input.channels`:
   - Construye `ChannelNotificationPayload` con el contacto resuelto.
   - Invoca al puerto de canal correspondiente (`EmailSenderPort`, `SmsSenderPort`, `PushNotificationPort`).
   - Recopila `ChannelDeliveryResult`.
5. Calcula `overallStatus` con `computeOverallDeliveryStatus()`.
6. Retorna `ExternalNotificationDispatchResult`.

**Contrato de entrada:**
```typescript
interface DispatchNotificationInput {
  sourceEventId: string;         // UUID — idempotencia
  eventType: string;             // tipo de evento (ej. 'ContratoFirmado')
  organizationId: string;
  companyId: string;
  branchId: string;
  recipientFirebaseUid: string;
  title: string;
  body: string;
  deepLink?: string;
  channels: NotificationChannel[];
  metadata?: Record<string, unknown>;
}
```

### 6.2 RecipientContactLookupPort / FirebaseRecipientContactLookupAdapter

**Responsabilidad:** Obtener los datos de contacto de un destinatario dado su Firebase UID.

**Comportamiento:**
- Llama a `getAuth().getUser(uid)` de Firebase Admin SDK.
- Lee `customClaims.fcmTokens` (array) o `customClaims.fcmToken` (string), normalizando siempre a array.
- Si Firebase retorna error (user not found, red): retorna `null` y loguea WARNING (UID enmascarado).
- Recibe `organizationId` para soporte futuro de resolución per-tenant.

### 6.3 PushNotificationPort / FirebasePushNotificationAdapter

**Responsabilidad:** Enviar una notificación push vía Firebase Cloud Messaging.

**Comportamiento:**
- Si `pushTokens` está vacío: retorna `SKIPPED` con `reason: NO_PUSH_TOKENS`.
- Construye `MulticastMessage` con tokens, notification (title, body) y data (sourceEventId, deepLink, eventType).
- Llama a `getMessaging().sendEachForMulticast(message)`.
- Si `successCount > 0`: retorna `DELIVERED`.
- Si todos los tokens fallan: retorna `FAILED`.
- Si FCM lanza excepción: captura, retorna `FAILED` con `error.code: FCM_ERROR`.
- `recipientTarget`: primero y último token enmascarado (`fcm-...XXXX`).

### 6.4 EmailSenderPort / ConsoleEmailSenderAdapter (fase 1)

**Responsabilidad:** Enviar un email al destinatario. En fase 1 imprime en consola.

**Comportamiento fase 1:**
- Si `email` es null: retorna `SKIPPED` con `reason: NO_EMAIL`.
- Imprime el mensaje en consola con el email enmascarado.
- Retorna `DELIVERED` con `recipientTarget: maskEmail(email)`.

**Fase 2:** reemplazar por adaptador SMTP/SendGrid sin cambiar el puerto.

### 6.5 SmsSenderPort / ConsoleSMSSenderAdapter (fase 1)

**Responsabilidad:** Enviar un SMS al destinatario. En fase 1 imprime en consola.

**Comportamiento fase 1:**
- Si `phoneNumber` es null: retorna `SKIPPED` con `reason: NO_PHONE`.
- Imprime el mensaje en consola con el teléfono enmascarado.
- Retorna `DELIVERED` con `recipientTarget: maskPhoneNumber(phoneNumber)`.

**Fase 2:** reemplazar por adaptador Twilio/AWS SNS sin cambiar el puerto.

### 6.6 NotificationsController (bandeja in-app)

**Responsabilidad:** Exponer los endpoints HTTP de la bandeja de notificaciones in-app para el usuario autenticado.

**Endpoints:**
- `GET /notifications` — lista las notificaciones del `req.firebaseUid` filtradas por `companyId`, `branchId` y opcionalmente `unreadOnly`. Devuelve `NotificationsResponse` (200).
- `POST /notifications/read-all` — marca todas las notificaciones del `req.firebaseUid` como leídas en el contexto `{ companyId, branchId }`. Responde 204 sin cuerpo.

**Seguridad:** `@UseGuards(FirebaseAuthGuard)` en el controlador — todos los endpoints requieren token Firebase válido. El filtro por `req.firebaseUid` es forzado en el handler; no se acepta `recipientId` como parámetro de entrada.

### 6.7 GetMyNotificationsHandler

**Responsabilidad:** Ejecutar la query `GetMyNotificationsQuery`: recuperar las notificaciones del usuario autenticado desde el `NotificationReadModelPort`.

**Flujo:**
1. Recibe `GetMyNotificationsQuery(firebaseUid, companyId, branchId, unreadOnly)`.
2. Resuelve `organizationId` desde el contexto de empresa (via `companyId`).
3. Llama a `NotificationReadModelPort.listForRecipient(organizationId, firebaseUid, { unreadOnly })`.
4. Retorna array de `NotificationRecord`.

### 6.8 MarkAllNotificationsReadHandler

**Responsabilidad:** Ejecutar el comando `MarkAllNotificationsReadCommand`: marcar todas las notificaciones del usuario en la empresa/sede como leídas.

**Flujo:**
1. Recibe `MarkAllNotificationsReadCommand(firebaseUid, companyId, branchId)`.
2. Resuelve `organizationId` desde el contexto de empresa.
3. Llama a `NotificationReadModelPort.markAllRead(organizationId, firebaseUid)`.
4. La operación es idempotente — si no hay notificaciones pendientes, no hace nada.

### 6.9 NotificationReadModelPort / PrismaNotificationReadModelRepository

**Responsabilidad:** Persistir y consultar el read model de notificaciones in-app en PostgreSQL (tabla `notification_read_models`).

**Operaciones:**
- `create(input, tx?)` — idempotente por `sourceEventId` (deduplicación). Acepta transacción opcional para participar en la transacción del OutboxRelay.
- `listForRecipient(organizationId, recipientFirebaseUid, filter?)` — consulta con aislamiento por `organizationId`, `recipientFirebaseUid` y opcionalmente `readAt IS NULL` si `unreadOnly=true`.
- `markAllRead(organizationId, recipientFirebaseUid)` — `UPDATE ... SET readAt = NOW() WHERE readAt IS NULL AND ...`.

---

## 7. Contratos de integración

### 7.1 Contrato de entrada (desde OutboxRelay)

El `OutboxRelay` del módulo `outbox` invoca al despachador con `DispatchNotificationInput` por cada evento de outbox procesado. El módulo `notification-templates` resuelve el contenido (title, body) antes de llamar al despachador.

### 7.2 Contrato de salida (resultado de despacho)

```typescript
interface ExternalNotificationDispatchResult {
  sourceEventId: string;
  recipientId: string;
  deliveries: ChannelDeliveryResult[];
  overallStatus: OverallDeliveryStatus;
  dispatchedAt: Date;
}
```

El resultado se devuelve al `OutboxRelay` para que pueda marcar el evento del outbox como procesado o reencolarlo según `overallStatus`.

### 7.3 Contrato HTTP de la bandeja in-app

Ver `packages/contracts/openapi/notifications.yaml v0.1.0`.

Resumen de operaciones:
- `GET /notifications` — autenticado, `companyId` + `branchId` obligatorios, `unreadOnly` opcional → `NotificationsResponse`.
- `POST /notifications/read-all` — autenticado, body `{ companyId, branchId }` → 204.

Ambos endpoints requieren token Firebase válido (`Authorization: Bearer <token>`). La identidad del destinatario se extrae del token, nunca de un parámetro de la petición.

---

## 8. Estados de interfaz aplicables

| Estado | Comportamiento |
| --- | --- |
| Proveedor externo no disponible | El canal afectado retorna FAILED; los demás canales continúan |
| Destinatario sin datos de contacto | Canal específico retorna SKIPPED |
| UID no existe en Firebase Auth | Todos los canales retornan SKIPPED (RECIPIENT_NOT_FOUND) |
| GCS no configurado | No aplica a este módulo |
| Sin tokens FCM | Canal PUSH retorna SKIPPED (NO_PUSH_TOKENS) |
| Token de sesión inválido/expirado (bandeja in-app) | `GET /notifications` y `POST /notifications/read-all` devuelven 401 |
| Sin notificaciones para el usuario (bandeja in-app) | `GET /notifications` devuelve `{ notifications: [] }` (200, no 404) |
| `unreadOnly=true` sin notificaciones no leídas | `GET /notifications` devuelve `{ notifications: [] }` (200, idempotente) |

---

## 9. Decisiones de diseño registradas

| Decisión | Razón |
| --- | --- |
| Consola como adaptador de email/SMS en fase 1 | Permite completar el ciclo completo de pruebas sin credenciales externas; el reemplazo es puntual (solo el adaptador). |
| organizationId en lookupContact | Soporte futuro para resolución de contacto personalizada por tenant. |
| No almacenar contactos en la BD del módulo | Evita duplicación de PII; Firebase Auth es la fuente autoritativa. |
| FCM multicast (sendEachForMulticast) | Soporta múltiples FCM tokens por usuario (multi-dispositivo). |
| SKIPPED ≠ fallo | Permite que el OutboxRelay marque el evento como procesado aunque el canal no esté disponible, sin bloquear el outbox. |
| Bandeja in-app: destinatario extraído del token de sesión | Impide que un usuario consulte o modifique notificaciones de otro usuario sin pasar parámetros extra. |
| Read model separado del despacho externo (dos módulos NestJS) | Evita que la tabla `notification_read_models` quede acoplada al ciclo de vida del despacho externo; cada módulo puede evolucionar independientemente. |
