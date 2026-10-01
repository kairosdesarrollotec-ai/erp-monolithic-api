---
modulo: Notificaciones
proceso: Despacho externo de notificaciones transversales
version: '1.0'
estado: APROBADO
fecha_aprobacion: '2026-10-01'
autores:
  - Equipo técnico KAIROS
fuentes_base:
  - bdd-notifications.md v1.0
  - sdd-notifications.md v1.0
  - artifacts/traceability/notifications/TR-07-dispatch.md
---

## 0. Control de cambios

| Versión | Fecha | Autor | Cambio |
| --- | --- | --- | --- |
| 1.0 | 2026-10-01 | Equipo técnico KAIROS | Documento inicial — arquitectura técnica del módulo TR-07. Refleja el estado mergeado a main el 2026-10-01 (430/430 tests, 86/86 suites). |

---

## 1. Control y documentos relacionados

| Campo | Referencia |
| --- | --- |
| BDD | bdd-notifications.md v1.0 |
| SDD | sdd-notifications.md v1.0 |
| Trazabilidad | artifacts/traceability/notifications/TR-07-dispatch.md |
| PR mergeado | #38 (feature/bloque-2-tr-07-notificaciones-externas → main, 2026-10-01) |
| Tests backend | 430/430 passing, 86/86 suites |

---

## 2. Objetivo y alcance técnico

Definir la implementación técnica del módulo `notifications` del backend NestJS: estructura de módulo, tipos de dominio, puertos (interfaces abstractas), adaptadores concretos, estrategia de testing con Jest ESM y las dependencias de infraestructura (Firebase Admin SDK).

---

## 3. Decisiones técnicas

### TDD-NOT-ADR-001: Arquitectura hexagonal — dominio sin dependencias de infraestructura

**Decisión:** El dominio (`domain/external-notification.ts`) define solo tipos TypeScript e interfaces puras. No importa NestJS, Prisma, Firebase ni ningún SDK externo. Los puertos (`application/ports/`) son clases abstractas NestJS inyectables.

**Razón:** Testabilidad completa del dominio sin mocks de infraestructura; adaptadores intercambiables sin tocar el dominio.

### TDD-NOT-ADR-002: Firebase Admin SDK — stubs via moduleNameMapper para Jest ESM

**Decisión:** `firebase-admin/messaging` y `firebase-admin/auth` no se auto-mockean con `jest.mock()` en modo `--experimental-vm-modules` (ESM). Se usan stubs TypeScript en `src/__stubs__/` que importan `jest.fn()` desde `@jest/globals` y se registran en `moduleNameMapper` del `jest.config.json`.

**Razón:** En ESM, `jest.mock('package')` sin factory no puede interceptar exportaciones nombradas de CJS. El stub vía `moduleNameMapper` reemplaza el módulo completo antes de que cualquier archivo lo importe.

**Stubs creados:**
- `src/__stubs__/firebase-admin-messaging.ts` — exporta `getMessaging = jest.fn()`
- `src/__stubs__/firebase-admin-auth.ts` — exporta `getAuth = jest.fn()`
- `src/__stubs__/firebase-admin.config.cjs` — no-op CJS para `config/firebase-admin.config`

### TDD-NOT-ADR-003: Consola como adaptador EMAIL/SMS en fase 1

**Decisión:** `ConsoleEmailSenderAdapter` y `ConsoleSMSSenderAdapter` implementan los puertos `EmailSenderPort` y `SmsSenderPort` imprimiendo en consola y retornando DELIVERED.

**Razón:** Completa el ciclo de pruebas del despachador sin credenciales externas. El reemplazo por SMTP/Twilio solo requiere un nuevo adaptador; el puerto y el servicio no cambian.

### TDD-NOT-ADR-004: NotificationChannel movido a common/domain

**Decisión:** El enum `NotificationChannel` vive en `apps/api/src/common/domain/notification-channel.ts`, no dentro del módulo `notifications`.

**Razón:** El módulo `outbox` y el módulo `notification-templates` también referencian `NotificationChannel`. Ubicarlo en `common` evita dependencias circulares entre módulos.

### TDD-NOT-ADR-005: setupFilesAfterEnv en jest-integration.json

**Decisión:** `test/jest-integration.json` incluye `setupFilesAfterEnv: ["<rootDir>/src/jest-esm-globals.ts"]` y el mismo `moduleNameMapper` que el jest.config.json de unidad.

**Razón:** Sin `setupFilesAfterEnv`, los tests de integración fallan con `ReferenceError: jest is not defined` en archivos que usan `jest.fn()` al nivel de módulo (fuera de `beforeEach`).

---

## 4. Tabla de trazabilidad

| BDD | SDD | TDD (decisión) | Archivo de implementación | Test |
| --- | --- | --- | --- | --- |
| BR-NOT-001 (idempotencia) | §6.1 NotificationDispatcherService | TDD-NOT-ADR-001 | notification-dispatcher.service.ts | dispatch-notification.command.spec.ts |
| BR-NOT-002 (SKIPPED ≠ fallo) | §6.3 FirebasePushNotificationAdapter | TDD-NOT-ADR-001 | firebase-push-notification.adapter.ts | firebase-push-notification.adapter.spec.ts |
| BR-NOT-003 (PII masking) | §6.2 lookup, §6.3 push | TDD-NOT-ADR-001 | external-notification.ts (mask*) | external-notification.spec.ts |
| BR-NOT-004 (organizationId en lookup) | §6.2 FirebaseRecipientContactLookupAdapter | TDD-NOT-ADR-002 | firebase-recipient-contact-lookup.adapter.ts | firebase-recipient-contact-lookup.adapter.spec.ts |
| BR-NOT-005 (fallo de canal no propaga) | §6.3 adapter error handling | TDD-NOT-ADR-001 | firebase-push-notification.adapter.ts | firebase-push-notification.adapter.spec.ts |
| SC-NOT-001 | §6.1 dispatch flow | TDD-NOT-ADR-002 stubs | firebase-push-notification.adapter.spec.ts | SC-NOT-001: DELIVERED |
| SC-NOT-002 | §6.3 SKIPPED | TDD-NOT-ADR-002 | firebase-push-notification.adapter.spec.ts | SC-NOT-002: SKIPPED NO_PUSH_TOKENS |
| SC-NOT-003 | §6.3 FCM error | TDD-NOT-ADR-002 | firebase-push-notification.adapter.spec.ts | SC-NOT-003: FCM_ERROR |
| SC-NOT-004 | §6.2 null lookup | TDD-NOT-ADR-002 | firebase-recipient-contact-lookup.adapter.spec.ts | SC-NOT-004: retorna null |
| SC-NOT-005 | §6.2 FCM token normalization | TDD-NOT-ADR-002 | firebase-recipient-contact-lookup.adapter.spec.ts | SC-NOT-005: array y singular |

---

## 5. Estructura de módulo NestJS

```
apps/api/src/modules/notifications/
├── domain/
│   └── external-notification.ts        # Tipos e interfaces puras; funciones mask*
├── application/
│   ├── commands/
│   │   └── dispatch-notification.command.ts
│   └── ports/
│       ├── notification-dispatcher.port.ts     # Puerto primario (abstract class)
│       ├── email-sender.port.ts
│       ├── push-notification.port.ts
│       ├── sms-sender.port.ts
│       └── recipient-contact-lookup.port.ts
├── infrastructure/
│   └── adapters/
│       ├── firebase-push-notification.adapter.ts
│       ├── firebase-push-notification.adapter.spec.ts
│       ├── firebase-recipient-contact-lookup.adapter.ts
│       ├── firebase-recipient-contact-lookup.adapter.spec.ts
│       ├── console-email-sender.adapter.ts
│       └── console-sms-sender.adapter.ts
└── notification-dispatch.module.ts

apps/api/src/common/domain/
└── notification-channel.ts             # Enum NotificationChannel (EMAIL, SMS, PUSH)

apps/api/src/__stubs__/
├── firebase-admin-messaging.ts         # Stub ESM: getMessaging = jest.fn()
├── firebase-admin-auth.ts              # Stub ESM: getAuth = jest.fn()
└── firebase-admin.config.cjs           # Stub CJS: no-op initFirebaseAdmin

apps/api/test/
└── jest-integration.json               # Incluye setupFilesAfterEnv + moduleNameMapper
```

---

## 6. Configuración Jest ESM (moduleNameMapper)

```json
{
  "moduleNameMapper": {
    "^jose$": "<rootDir>/src/__stubs__/jose.cjs",
    "config/firebase-admin\\.config$": "<rootDir>/src/__stubs__/firebase-admin.config.cjs",
    "^firebase-admin/messaging$": "<rootDir>/src/__stubs__/firebase-admin-messaging.ts",
    "^firebase-admin/auth$": "<rootDir>/src/__stubs__/firebase-admin-auth.ts"
  }
}
```

Este mapeo aplica tanto en `jest.config.json` (unidad) como en `test/jest-integration.json` (integración).

---

## 7. Modelo de dominio

### NotificationChannel (enum)
```typescript
export enum NotificationChannel {
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  PUSH = 'PUSH',
}
```

### ChannelNotificationPayload
```typescript
interface ChannelNotificationPayload {
  sourceEventId: string;
  organizationId: string;
  companyId: string;
  branchId: string;
  eventType: string;
  recipient: RecipientContact;
  title: string;
  body: string;
  deepLink?: string;
  metadata?: Record<string, unknown>;
}
```

### RecipientContact
```typescript
interface RecipientContact {
  recipientId: string;
  email: string | null;
  phoneNumber: string | null;
  pushTokens: readonly string[];
  displayName: string | null;
}
```

### ChannelDeliveryResult
```typescript
interface ChannelDeliveryResult {
  channel: NotificationChannel;
  status: 'DELIVERED' | 'FAILED' | 'SKIPPED';
  recipientTarget: string;       // PII-masked
  providerMessageId?: string;
  reason?: string;
  error?: { code: string; message: string };
  attemptedAt: Date;
}
```

### OverallDeliveryStatus
```typescript
type OverallDeliveryStatus =
  | 'ALL_DELIVERED'
  | 'PARTIALLY_DELIVERED'
  | 'FAILED'
  | 'ALL_SKIPPED';
```

---

## 8. Patrones de implementación

### FirebasePushNotificationAdapter

```typescript
// Importa getMessaging desde el módulo firebase-admin/messaging
// En tests, el moduleNameMapper redirige a __stubs__/firebase-admin-messaging.ts
// donde getMessaging = jest.fn() → los tests pueden hacer (getMessaging as jest.Mock).mockReturnValue(...)

import { getMessaging } from 'firebase-admin/messaging';

async send(payload: ChannelNotificationPayload): Promise<ChannelDeliveryResult> {
  if (payload.recipient.pushTokens.length === 0) {
    return { status: 'SKIPPED', reason: 'NO_PUSH_TOKENS', channel: 'PUSH', ... };
  }
  try {
    const result = await getMessaging().sendEachForMulticast({
      tokens: [...payload.recipient.pushTokens],
      notification: { title: payload.title, body: payload.body },
      data: { sourceEventId: payload.sourceEventId, deepLink: payload.deepLink ?? '', eventType: payload.eventType },
    });
    if (result.successCount > 0) return { status: 'DELIVERED', channel: 'PUSH', ... };
    return { status: 'FAILED', channel: 'PUSH', reason: `${result.failureCount} tokens failed...`, ... };
  } catch (err) {
    return { status: 'FAILED', channel: 'PUSH', error: { code: 'FCM_ERROR', message: err.message }, ... };
  }
}
```

### FirebaseRecipientContactLookupAdapter

```typescript
// organizationId recibido para soporte futuro — actualmente lookup es org-agnóstico
async lookupContact(uid: string, _organizationId: string): Promise<RecipientContact | null> {
  try {
    initFirebaseAdmin();
    const user = await getAuth().getUser(uid);
    const rawTokens = user.customClaims?.fcmTokens ?? user.customClaims?.fcmToken ?? [];
    const pushTokens = Array.isArray(rawTokens) ? rawTokens.filter(t => typeof t === 'string') : typeof rawTokens === 'string' ? [rawTokens] : [];
    return { recipientId: user.uid, email: user.email ?? null, phoneNumber: user.phoneNumber ?? null, pushTokens, displayName: user.displayName ?? null };
  } catch (error) {
    this.logger.warn(`Firebase lookup failed for uid ${uid.slice(0,6)}...: ${error.message}`);
    return null;
  }
}
```

---

## 9. Guía de testing

### Patrón para tests de adaptadores Firebase

```typescript
// NO usar jest.mock('firebase-admin/messaging') — no funciona en ESM sin factory
// El moduleNameMapper ya redirige firebase-admin/messaging a __stubs__/firebase-admin-messaging.ts
// Importar directamente y usar el cast:

import { getMessaging } from 'firebase-admin/messaging';

beforeEach(() => {
  jest.clearAllMocks();
  (getMessaging as jest.Mock).mockReturnValue({
    sendEachForMulticast: mockSendEachForMulticast,
  });
});
```

### Cobertura de tests requerida

| Escenario | Archivo de test |
| --- | --- |
| DELIVERED con token FCM | firebase-push-notification.adapter.spec.ts |
| SKIPPED sin tokens FCM | firebase-push-notification.adapter.spec.ts |
| FAILED por error FCM | firebase-push-notification.adapter.spec.ts |
| FAILED todos los tokens | firebase-push-notification.adapter.spec.ts |
| Lookup resuelve contacto completo | firebase-recipient-contact-lookup.adapter.spec.ts |
| Lookup normaliza token FCM singular | firebase-recipient-contact-lookup.adapter.spec.ts |
| Lookup retorna null si Firebase falla | firebase-recipient-contact-lookup.adapter.spec.ts |
| computeOverallDeliveryStatus | external-notification.spec.ts |
| maskEmail / maskPhoneNumber / maskPushToken | external-notification.spec.ts |
