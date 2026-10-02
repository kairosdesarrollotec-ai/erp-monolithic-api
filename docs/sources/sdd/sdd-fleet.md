---
modulo: Flota (Fleet)
proceso: Gestión del catálogo de vehículos
version: '1.0'
estado: APROBADO
fecha_aprobacion: '2026-10-01'
autores:
  - Russbel Hernández (BA)
  - Equipo técnico KAIROS
fuentes_base:
  - bdd-fleet.md v1.0
  - packages/contracts/openapi/fleet.yaml v0.2.0
  - SDD-KAIROS-MVP-002-TRANSVERSAL §16
  - artifacts/traceability/fleet/FLOTA-01-traceability.md
---

## 0. Control de cambios

| Versión | Fecha | Autor | Cambio |
| --- | --- | --- | --- |
| 1.0 | 2026-10-01 | Russbel Hernández | Documento inicial — diseño funcional del módulo Fleet implementado (22/22 tests frontend). |

---

## 1. Control y gobernanza

| Campo | Valor |
| --- | --- |
| Dueño del módulo | Equipo técnico KAIROS |
| Revisado por | Russbel Hernández (BA) |
| Estado | APROBADO |
| BDD de referencia | bdd-fleet.md v1.0 |
| TDD de referencia | tdd-fleet.md v1.0 |
| Contrato OpenAPI | packages/contracts/openapi/fleet.yaml v0.2.0 |
| Trazabilidad | artifacts/traceability/fleet/FLOTA-01-traceability.md |

---

## 2. Resumen ejecutivo

El módulo `fleet` gestiona el **catálogo de vehículos** de las empresas del Grupo KAIROS. Provee las operaciones CRUD sobre vehículos, el ciclo de vida de su estado operativo y la carga de fotos vía Google Cloud Storage. Es un módulo de datos maestros: los módulos `reservations` y `rentals` dependen de él para conocer qué vehículos existen y en qué estado están.

El módulo está implementado como **monolito modular NestJS** con contrato OpenAPI versionado (fleet.yaml v0.2.0). La foto del vehículo se gestiona con el patrón de URL firmada GCS (ADR-KAI-005, extendido a Fleet en PROP-008).

---

## 3. Alcance

### 3.1 Incluido

- CRUD de vehículos: POST (crear), GET (listar), PATCH datos, PATCH estado.
- Carga de fotos vía URL firmada GCS: POST /photo-upload-sessions.
- Filtrado por empresa, sede, estado y placa.
- Validación de aislamiento por sede (IDOR por sede — fleet-role.policy.ts).
- Idempotencia en mutaciones via `IdempotencyInterceptor`.
- Permisos de escritura/lectura/cross-branch por rol.

### 3.2 Excluido

- Rate cards y tarifas — referenciadas en TDD pero fuera del MVP fase 1.
- Historial de mantenimientos — fuera del MVP.
- GPS en tiempo real — fuera del MVP.
- Gestión de seguros vehiculares — fuera del MVP.

### 3.3 Dependencias hacia este módulo

| Módulo | Operación |
| --- | --- |
| `reservations` | Consulta disponibilidad; cambia estado a RENTED al confirmar |
| `rentals` | Cambia estado a RENTED al iniciar alquiler; a AVAILABLE al cerrar devolución |

### 3.4 Dependencias de este módulo

| Servicio | Relación |
| --- | --- |
| Google Cloud Storage | Almacena fotos vía URL firmada (PUT a GCS) |
| Firebase Authentication | Autentica y provee datos de contexto (companyId, branchId, roles) |
| `IdempotencyInterceptor` (NestJS) | Deduplicación de mutaciones |

---

## 4. Drivers de diseño

| Driver | Descripción |
| --- | --- |
| Datos maestros compartidos | Vehículos son el recurso central; su estado afecta reservas y alquileres |
| Aislamiento por sede | Un operador de Sede A no accede a vehículos de Sede B (IDOR) |
| Foto como blob externo | Imágenes de hasta 12 MB no se almacenan en la BD; van a GCS |
| Idempotencia operativa | Operaciones de mutación son seguras de repetir con la misma clave |
| Contract-first | El contrato OpenAPI fue escrito antes de la implementación |

---

## 5. Componentes

### 5.1 FleetController (presentación)

**Endpoints:**
- `POST /fleet/vehicles/photo-upload-sessions` — solicita URL firmada GCS
- `POST /fleet/vehicles` — registra nuevo vehículo
- `GET /fleet/vehicles` — lista vehículos con filtros
- `GET /fleet/vehicles/{id}` — obtiene detalle de un vehículo
- `PATCH /fleet/vehicles/{id}` — actualiza datos del vehículo
- `PATCH /fleet/vehicles/{id}/status` — cambia estado operativo

Todos los endpoints requieren Bearer token Firebase. Los parámetros de scope `companyId` + `branchId` se validan en cada request.

### 5.2 FleetRolePolicy (autorización)

**Responsabilidad:** Verificar permisos por rol antes de cada operación.

| Operación | Roles con permiso |
| --- | --- |
| Escritura (POST, PATCH) | CAMPO (FLEET_OPERATOR), ADMINISTRACION (COMPANY_ADMIN), GERENCIA (OPS_MANAGER), PLATFORM_ADMIN |
| Lectura (GET) | Los anteriores + FRONT_OFFICE (RESERVATION_AGENT), FINANZAS (FINANCE_APPROVER), AUDITORIA (CORPORATE_AUDITOR), READ_ONLY |
| Cross-branch | GERENCIA, ADMINISTRACION, PLATFORM_ADMIN |

> Nota: Los roles listados en el contrato (`GERENCIA`, `CAMPO`, etc.) son los aliases del negocio para los roles canónicos del sistema (OPS_MANAGER, FLEET_OPERATOR, etc.) definidos en SDD-KAIROS-TRANSVERSAL §15.5. Los permisos están marcados como PROVISIONAL en fleet.yaml v0.2.0 hasta que ADM-02 esté implementado.

**assertCrossBranchAllowed:** Si el request incluye `assignedBranchId` diferente al `branchId` del contexto, solo roles cross-branch pueden proceder. Retorna 403 si no.

### 5.3 VehicleService (aplicación)

**Responsabilidades:**
- Validar unicidad de placa por empresa antes de crear.
- Validar transiciones de estado (BR-FLT-006).
- Delegar la persistencia a `VehicleRepository`.
- Validar que `photoUrl` es HTTPS de GCS (no data: URI).

### 5.4 GcsPhotoUploadService (infraestructura)

**Responsabilidad:** Generar URLs firmadas de GCS para carga de fotos.

**Flujo:**
1. Recibe `contentType` (image/jpeg | image/webp) y `contentLength` (≤ 12 MB).
2. Valida tipo y tamaño.
3. Genera `objectName` único (UUID + extensión según contentType).
4. Llama a GCS SDK para obtener URL firmada de PUT (15 min de validez).
5. Retorna `{ uploadUrl, objectUrl }`.
6. Retorna 503 si `GCS_BUCKET_NAME` no está configurado en el entorno.

### 5.5 VehicleRepository (infraestructura)

**Responsabilidad:** Persistencia de vehículos en PostgreSQL vía Prisma.

Filtros soportados en listado:
- `companyId` (obligatorio)
- `branchId` (obligatorio cuando no cross-branch)
- `status` (opcional)
- `plate` (opcional, búsqueda parcial)
- Paginación: `page`, `limit` (default 20, máx 100)

---

## 6. Flujos detallados

### 6.1 Registrar vehículo con foto

```
Cliente          FleetController    FleetRolePolicy    GcsPhotoUploadService    VehicleService    VehicleRepository
   │                   │                  │                     │                     │                 │
   │ POST /photo-upload-sessions         │                     │                     │                 │
   │──────────────────>│                  │                     │                     │                 │
   │                   │ assertWriteRole()│                     │                     │                 │
   │                   │─────────────────>│                     │                     │                 │
   │                   │ OK               │                     │                     │                 │
   │                   │<─────────────────│                     │                     │                 │
   │                   │ createSignedUrl()│                     │                     │                 │
   │                   │─────────────────────────────────────>  │                     │                 │
   │                   │ {uploadUrl, objectUrl}                  │                     │                 │
   │                   │<─────────────────────────────────────  │                     │                 │
   │ {uploadUrl, objectUrl}              │                     │                     │                 │
   │<──────────────────│                  │                     │                     │                 │
   │ PUT uploadUrl (archivo a GCS)       │                     │                     │                 │
   │ POST /fleet/vehicles {photoUrl: objectUrl, ...}           │                     │                 │
   │──────────────────>│                  │                     │                     │                 │
   │                   │ assertWriteRole()│                     │                     │                 │
   │                   │─────────────────>│                     │                     │                 │
   │                   │ create(vehicle)  │                     │                     │                 │
   │                   │──────────────────────────────────────────────────────────>  │                 │
   │                   │                  │                     │                     │ save()          │
   │                   │                  │                     │                     │────────────────>│
   │                   │                  │                     │                     │ VehicleResponse │
   │                   │                  │                     │                     │<────────────────│
   │ 201 VehicleResponse                 │                     │                     │                 │
   │<──────────────────│                  │                     │                     │                 │
```

### 6.2 Cambio de estado

```
Cliente          FleetController    FleetRolePolicy    VehicleService    VehicleRepository
   │                   │                  │                 │                 │
   │ PATCH /{id}/status {status: "MAINTENANCE"}             │                 │
   │──────────────────>│                  │                 │                 │
   │                   │ assertWriteRole()│                 │                 │
   │                   │─────────────────>│                 │                 │
   │                   │ changeStatus()   │                 │                 │
   │                   │──────────────────────────────────>│                 │
   │                   │                  │                 │ validateTransition()    │
   │                   │                  │                 │ (BR-FLT-006)    │
   │                   │                  │                 │ save()          │
   │                   │                  │                 │────────────────>│
   │ 200 VehicleResponse                 │                 │                 │
   │<──────────────────│                  │                 │                 │
```

---

## 7. Estados de interfaz (Frontend)

| Estado UI | Descripción | Comportamiento |
| --- | --- | --- |
| LOADING | Lista de vehículos cargando | Skeleton de tabla |
| READY | Lista con vehículos | Tabla con filtros, botón "Registrar Vehículo" |
| EMPTY | Sin vehículos para los filtros activos | Mensaje vacío con CTA de registro |
| ERROR | Error de red o autorización | Toast de error, opción de reintentar |
| MODAL_NEW_VEHICLE | Modal de registro abierto | Formulario RHF+Zod con paso de foto |
| MODAL_EDIT_VEHICLE | Modal de edición abierto | Datos actuales prellenados |
| PHOTO_UPLOADING | Subida de foto en progreso | Indicador de carga en el campo de foto |
| SAVING | Guardando vehículo | Botón deshabilitado + spinner |

---

## 8. Decisiones de diseño registradas

| Decisión | Razón |
| --- | --- |
| URL firmada para fotos (ADR-KAI-005 extendido) | Las imágenes no transitan por el API; GCS las recibe directamente desde el cliente. Reduce carga del servidor y cumple el límite de payload del NestJS gateway. |
| Prohibición de data: URI | Evita almacenar imágenes base64 en la BD; fuerza el flujo GCS. |
| Permisos PROVISIONAL en fleet.yaml v0.2.0 | ADM-02 (gestión de roles en UI) no está implementado. Los permisos actuales se basan en SDD-KAIROS-TRANSVERSAL §15.5 y son suficientes para MVP. |
| Status como transición explícita (endpoint separado) | Evita cambios de estado accidentales en actualizaciones de datos. El estado tiene su propia lógica de validación. |
| Idempotencia vía header | Permite al cliente reintentar en caso de timeout sin duplicar registros. |
