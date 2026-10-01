---
modulo: Notificaciones
proceso: Despacho externo de notificaciones transversales
version: '1.0'
estado: APROBADO
fecha_aprobacion: '2026-10-01'
autores:
  - Russbel Hernández (BA)
  - Equipo técnico KAIROS
fuentes_base:
  - BDD-KAIROS-MVP-002-TRANSVERSAL §12 (notificaciones y comunicaciones)
  - SDD-KAIROS-MVP-002-TRANSVERSAL §16 (módulo notifications)
  - TDD-KAIROS-MVP-002-TRANSVERSAL §notifications
  - artifacts/traceability/notifications/TR-07-dispatch.md
---

## 0. Control de cambios

| Versión | Fecha | Autor | Cambio |
| --- | --- | --- | --- |
| 1.0 | 2026-10-01 | Russbel Hernández | Documento inicial — consolida comportamiento observable del módulo TR-07 implementado, a partir de BDD transversal §12 y evidencias de pruebas (430/430 tests). |

---

## 1. Alcance del módulo

### 1.1 Incluido

- Despacho externo de notificaciones a través de los canales EMAIL, SMS y PUSH.
- Resolución de datos de contacto del destinatario a partir del Firebase UID.
- Transformación de un evento de dominio entrante en uno o más intentos de entrega por canal.
- Registro del resultado de cada intento (DELIVERED, FAILED, SKIPPED).
- Cálculo del estado agregado de despacho (ALL_DELIVERED, PARTIALLY_DELIVERED, FAILED, ALL_SKIPPED).

### 1.2 Excluido

- Redacción del contenido (título, cuerpo) de las notificaciones — responsabilidad del módulo `notification-templates`.
- Enrutamiento de eventos de dominio al despachador — responsabilidad del módulo `outbox` vía `OutboxRelay`.
- Canal WhatsApp directo: los canales documentados como "WhatsApp" en BDD §12 se implementan como SMS hasta que se incorpore un proveedor WhatsApp Business API aprobado.
- Notificaciones internas de sistema (bandeja in-app) — fuera del alcance del MVP.
- Plantillas de contenido con formato propio por empresa — el despachador solo recibe título y cuerpo ya resueltos.

### 1.3 Dependencias

- `outbox` — publica eventos de dominio que disparan el despacho.
- `notification-templates` — resuelve título y cuerpo por tipo de evento y organización.
- Firebase Authentication — fuente de datos de contacto del destinatario (email, teléfono, FCM tokens).
- Firebase Cloud Messaging (FCM) — proveedor de push notifications en producción.

---

## 2. Actores y sistemas

| Actor / Sistema | Tipo | Participación |
| --- | --- | --- |
| OutboxRelay | Sistema | Invoca al despachador por cada evento publicado en el outbox |
| NotificationDispatcherPort | Puerto de dominio | Punto de entrada del caso de uso de despacho |
| Firebase Authentication | Sistema externo | Fuente de contacto del destinatario (UID → email, teléfono, FCM tokens) |
| Firebase Cloud Messaging | Sistema externo | Canal PUSH en producción |
| Proveedor EMAIL (fase 1: consola) | Sistema externo / mock | Canal EMAIL — consola en dev/staging, proveedor real en producción |
| Proveedor SMS (fase 1: consola) | Sistema externo / mock | Canal SMS — consola en dev/staging, proveedor real en producción |
| Cliente / destinatario | Persona | Recibe la notificación en su dispositivo o bandeja de correo |
| Personal operativo | Persona | Recibe notificaciones de grupo (WhatsApp/SMS grupal — ver BDD §12) |

---

## 3. Catálogo de datos

### DAT-NOT-001: Evento de dominio entrante

Datos que el `OutboxRelay` entrega al despachador por cada evento publicado en el outbox.

| Campo | Tipo | Obligatorio | Descripción |
| --- | --- | --- | --- |
| sourceEventId | UUID | Sí | Identificador único del evento de outbox — usado para idempotencia |
| eventType | string | Sí | Tipo de evento de dominio (ej. `ContratoFirmado`, `ReservaConfirmada`) |
| organizationId | UUID | Sí | Organización del tenant — requerido para aislamiento multiempresa |
| companyId | UUID | Sí | Empresa dentro de la organización |
| branchId | UUID | Sí | Sede de la empresa |
| recipientFirebaseUid | string | Sí | UID de Firebase del destinatario principal |
| title | string | Sí | Título de la notificación (resuelto por `notification-templates`) |
| body | string | Sí | Cuerpo del mensaje (resuelto por `notification-templates`) |
| channels | NotificationChannel[] | Sí | Lista de canales a intentar: EMAIL, SMS, PUSH |
| deepLink | string | No | Ruta interna del ERP para acción directa desde la notificación |
| metadata | Record<string, unknown> | No | Datos auxiliares del evento para enriquecimiento de plantillas |

### DAT-NOT-002: Contacto del destinatario

Datos resueltos desde Firebase Auth para el `recipientFirebaseUid`.

| Campo | Tipo | Obligatorio | Descripción |
| --- | --- | --- | --- |
| recipientId | string | Sí | UID de Firebase (igual al recipientFirebaseUid de DAT-NOT-001) |
| email | string \| null | No | Email registrado en Firebase Auth |
| phoneNumber | string \| null | No | Teléfono registrado en Firebase Auth |
| pushTokens | string[] | No | Tokens FCM registrados en `customClaims.fcmTokens` o `customClaims.fcmToken` |
| displayName | string \| null | No | Nombre para personalización del mensaje |

### DAT-NOT-003: Resultado de entrega por canal

| Campo | Tipo | Descripción |
| --- | --- | --- |
| channel | NotificationChannel | Canal intentado: EMAIL, SMS, PUSH |
| status | ChannelDeliveryStatus | DELIVERED, FAILED, SKIPPED |
| recipientTarget | string | Identificador del destinatario enmascarado (PII: email parcial, teléfono parcial, token parcial) |
| providerMessageId | string? | ID de mensaje del proveedor externo (ej. messageId de FCM) |
| reason | string? | Razón del SKIPPED o del FAILED (ej. NO_EMAIL, NO_PUSH_TOKENS) |
| error | {code, message}? | Detalle del error técnico si status=FAILED |
| attemptedAt | Date | Timestamp del intento |

### DAT-NOT-004: Resultado agregado del despacho

| Campo | Tipo | Descripción |
| --- | --- | --- |
| sourceEventId | UUID | Identificador del evento origen |
| recipientId | string | UID del destinatario |
| deliveries | ChannelDeliveryResult[] | Resultados por canal (DAT-NOT-003) |
| overallStatus | OverallDeliveryStatus | ALL_DELIVERED, PARTIALLY_DELIVERED, FAILED, ALL_SKIPPED |
| dispatchedAt | Date | Timestamp del despacho completo |

---

## 4. Catálogo de eventos de notificación

Los siguientes eventos están definidos en **BDD-KAIROS-MVP-002-TRANSVERSAL §12** y son los que el despachador debe poder manejar. El contenido (título, cuerpo) lo resuelve `notification-templates` por cada evento.

| ID de evento (eventType) | Disparador | Canal primario BDD §12 | Destinatario |
| --- | --- | --- | --- |
| `ContratoFirmado` | Contrato de alquiler firmado | WhatsApp/SMS (F01) + PUSH | Cliente |
| `RecordatorioDevolución` | 3 horas antes de la hora pactada de devolución | SMS/llamada | Cliente |
| `DevoluciónCompletada` | Devolución cerrada sin incidencias activas | WhatsApp/SMS (F02) + PUSH | Cliente |
| `DañoDetectado` | Daño registrado en la inspección de retorno | Directo (llamada/presencial) | Cliente |
| `SolicitudRecojoAeropuerto` | Solicitud de traslado en consulta | WhatsApp/SMS (F05) | Grupo Consultas |
| `CierreConsultaSinConversión` | Consulta cerrada sin reserva ni alquiler | Registro interno | Base de datos interna |
| `ReservaConfirmada` | Reserva creada y pago confirmado | WhatsApp/SMS (F03) + PUSH | Cliente |
| `VehículoReservadoVendido` | Vehículo de una reserva activa marcado como vendido | Llamada/WhatsApp | Cliente |
| `PublicaciónVacante` | Vacante publicada en reclutamiento | WhatsApp, redes, portales | Candidatos potenciales |
| `ConvocatoriaEntrevista` | Candidato convocado a entrevista | WhatsApp | Candidato |
| `ResultadoSelección` | Proceso de selección concluido para un candidato | Directo | Candidato |
| `SolicitudSalidaCampo` | Solicitud de visita a campo registrada | WhatsApp (Formato propio) | Grupo Consultas |

> **Nota:** En fase MVP los canales "WhatsApp" se despachan via SMS hasta que se integre un proveedor WhatsApp Business API. El canal PUSH se despacha via FCM. Los eventos con canal "Directo" no tienen despacho automático en fase 1 — se registran como ALL_SKIPPED con `reason: MANUAL_CHANNEL`.

---

## 5. Reglas de negocio

### BR-NOT-001: Idempotencia por sourceEventId + canal
**Prioridad:** Alta

Un mismo `sourceEventId` no debe producir más de un intento de entrega por canal. Si el `OutboxRelay` reencola un evento ya procesado, el despachador debe detectar la duplicación y retornar el resultado previo sin redispachar.

**Condición:** Si existe un resultado registrado para `sourceEventId` + `channel` con estado DELIVERED, no reintentar.

### BR-NOT-002: SKIPPED no es un fallo de sistema
**Prioridad:** Alta

Si un canal no puede intentarse porque el destinatario no tiene el contacto requerido (email nulo, teléfono nulo, FCM tokens vacíos), el resultado es `SKIPPED`, no `FAILED`. El sistema no debe tratar SKIPPED como error operativo.

| Condición de SKIPPED | Razón registrada |
| --- | --- |
| pushTokens vacíos para canal PUSH | NO_PUSH_TOKENS |
| email nulo para canal EMAIL | NO_EMAIL |
| phoneNumber nulo para canal SMS | NO_PHONE |
| Canal marcado como MANUAL_CHANNEL | MANUAL_CHANNEL |

### BR-NOT-003: PII enmascarada en logs y en resultado
**Prioridad:** Crítica

El campo `recipientTarget` de `ChannelDeliveryResult` nunca expone datos de contacto completos. Las funciones de enmascaramiento son:
- Email: `u***r@dominio.com` (primer y último caracter del local + dominio completo)
- Teléfono: `+51***4567` (3 primeros + 4 últimos dígitos)
- FCM token: `fcm-...7890` (4 primeros + 4 últimos caracteres)

Ningún log de nivel INFO o superior registra el token FCM, el email completo, ni el teléfono completo.

### BR-NOT-004: Resolución de contacto con organizationId
**Prioridad:** Alta

La llamada a `RecipientContactLookupPort.lookupContact(uid, organizationId)` siempre incluye el `organizationId` para soportar futura resolución de contactos por tenant. Si Firebase Auth no encuentra el UID, el resultado es `null` y todos los canales quedan como SKIPPED con `reason: RECIPIENT_NOT_FOUND`.

### BR-NOT-005: Fallo de canal no propaga excepción
**Prioridad:** Alta

Un error del proveedor externo (FCM quota exceeded, error SMTP, SMS gateway timeout) no debe lanzar excepción al llamador. El canal afectado registra `status: FAILED` con el código de error. Los demás canales del mismo despacho continúan intentándose.

### BR-NOT-006: Canales son configurables por tipo de evento
**Prioridad:** Media

El llamador (OutboxRelay vía notification-templates) es responsable de decidir qué canales intentar según el `eventType`. El despachador no filtra canales por tipo de evento — solo ejecuta los canales que recibe en `DispatchNotificationInput.channels`.

### BR-NOT-007: Registro interno siempre
**Prioridad:** Alta

Cada despacho genera un `ExternalNotificationDispatchResult` que queda accesible para auditoría. El `overallStatus` se calcula según la combinación de resultados de canal (ALL_DELIVERED, PARTIALLY_DELIVERED, FAILED, ALL_SKIPPED).

---

## 6. Máquina de estados del despacho

```
[Evento recibido por OutboxRelay]
         │
         ▼
[Lookup contacto (Firebase Auth)]
         │
    ┌────┴────┐
    │null     │encontrado
    ▼         ▼
[ALL_SKIPPED] [Por cada canal en channels[]]
              │
     ┌────────┼────────┐
     │EMAIL   │SMS     │PUSH
     ▼        ▼        ▼
  DELIVERED  SKIPPED  FAILED
  FAILED     DELIVERED ...
  SKIPPED
              │
              ▼
  [computeOverallDeliveryStatus()]
         │
    ┌────┴─────────┬──────────────┐
    ▼              ▼              ▼
ALL_DELIVERED  PARTIALLY_     ALL_SKIPPED
               DELIVERED /
               FAILED
```

---

## 7. Escenarios verificables

### SC-NOT-001: Despacho PUSH exitoso a destinatario con tokens FCM

**Dado** que el OutboxRelay publica el evento `ContratoFirmado` con channels=[PUSH]
**Y** el destinatario tiene FCM tokens registrados en Firebase Auth
**Cuando** el despachador invoca al adaptador FCM
**Entonces** el resultado es `DELIVERED` para el canal PUSH
**Y** `overallStatus` es `ALL_DELIVERED`
**Y** `recipientTarget` contiene el token enmascarado (ej. `fcm-...7890`)
**Y** el log no contiene el token FCM completo

### SC-NOT-002: SKIPPED cuando destinatario no tiene FCM tokens

**Dado** que el evento tiene channels=[PUSH]
**Y** el destinatario no tiene FCM tokens en Firebase Auth (array vacío)
**Cuando** el despachador evalúa el canal PUSH
**Entonces** el resultado es `SKIPPED` con `reason: NO_PUSH_TOKENS`
**Y** `overallStatus` es `ALL_SKIPPED`
**Y** no se realiza ninguna llamada a Firebase FCM

### SC-NOT-003: Fallo de FCM no propaga excepción

**Dado** que el evento tiene channels=[PUSH]
**Y** FCM retorna un error de cuota
**Cuando** el adaptador captura la excepción
**Entonces** el resultado es `FAILED` con `error.code: FCM_ERROR`
**Y** `overallStatus` es `FAILED`
**Y** el despachador retorna normalmente sin lanzar excepción

### SC-NOT-004: Firebase Auth no encuentra al destinatario

**Dado** que el UID del destinatario no existe en Firebase Auth
**Cuando** el adaptador de lookup llama a `getAuth().getUser(uid)`
**Entonces** `lookupContact` retorna `null`
**Y** todos los canales quedan en `SKIPPED` con `reason: RECIPIENT_NOT_FOUND`
**Y** el log registra un WARNING (sin exponer el UID completo)

### SC-NOT-005: Resolución de contacto con tokens FCM en array y en singular

**Dado** que un usuario tiene `customClaims.fcmToken: 'token-único'` (string, no array)
**Cuando** el adaptador de lookup lee el customClaim
**Entonces** `pushTokens` contiene `['token-único']` (normalizado a array)

**Dado** que otro usuario tiene `customClaims.fcmTokens: ['token-a', 'token-b']` (array)
**Cuando** el adaptador de lookup lee el customClaim
**Entonces** `pushTokens` contiene `['token-a', 'token-b']`

### SC-NOT-006: Despacho con múltiples canales — resultado parcial

**Dado** que el evento tiene channels=[EMAIL, PUSH]
**Y** el destinatario tiene email pero no FCM tokens
**Cuando** el despachador intenta ambos canales
**Entonces** EMAIL→DELIVERED, PUSH→SKIPPED
**Y** `overallStatus` es `PARTIALLY_DELIVERED`

---

## 8. Restricciones de privacidad y seguridad

- Los datos de contacto (email, teléfono, FCM token) son PII. Se enmascaran siempre antes de registrar en logs o en el resultado.
- El `organizationId` se valida en cada despacho — no se permite despacho sin contexto de tenant.
- El módulo no almacena datos de contacto en su propia base de datos — consulta Firebase Auth en tiempo real.
- No se registran contraseñas, tokens de sesión ni secretos de API en ningún log del módulo.
