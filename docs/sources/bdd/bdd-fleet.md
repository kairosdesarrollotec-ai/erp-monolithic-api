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
  - packages/contracts/openapi/fleet.yaml v0.2.0
  - SDD-KAIROS-MVP-002-TRANSVERSAL §16 (módulo fleet)
  - TDD-KAIROS-MVP-002-TRANSVERSAL §fleet
  - artifacts/traceability/fleet/FLOTA-01-traceability.md
---

## 0. Control de cambios

| Versión | Fecha | Autor | Cambio |
| --- | --- | --- | --- |
| 1.0 | 2026-10-01 | Russbel Hernández | Documento inicial — consolida comportamiento observable del módulo Fleet implementado. Fuente primaria: fleet.yaml v0.2.0 y trazabilidad FLOTA-01 (22/22 tests). |

---

## 1. Alcance del módulo

### 1.1 Incluido

- Registro de vehículos en la flota de una empresa/sede del Grupo KAIROS.
- Actualización de datos de un vehículo existente.
- Cambio de estado operativo de un vehículo (AVAILABLE, RENTED, MAINTENANCE, OUT_OF_SERVICE).
- Listado filtrado de vehículos por empresa, sede, estado y placa.
- Carga de foto de vehículo a través de Google Cloud Storage vía URL firmada.
- Consulta de disponibilidad de vehículos por intervalo de fechas.

### 1.2 Excluido

- Tarjetas de tarifas (rate cards) — fuera del MVP (referenciado en TDD pero no implementado en fase 1).
- Mantenimiento programado y gestión de talleres.
- Integración GPS en tiempo real.
- Historial de alquileres del vehículo (responsabilidad del módulo `rentals`).
- Venta de vehículos.
- Seguros y documentación vehicular — fuera del MVP.

### 1.3 Dependencias

- `reservations` y `rentals` — consultan la disponibilidad y cambian el estado del vehículo.
- Google Cloud Storage — almacena las fotos de vehículos cargadas a través de URLs firmadas.
- Firebase Authentication — autentica y autoriza todas las operaciones.

---

## 2. Actores y sistemas

| Actor / Sistema | Tipo | Operaciones permitidas |
| --- | --- | --- |
| Fleet Operator (CAMPO) | Persona — rol estándar | Registro, actualización, cambio de estado, carga de foto — solo en su propia sede |
| Operations Manager (OPS_MANAGER) | Persona — rol privilegiado | Todas las operaciones, incluyendo cross-branch |
| Company Administrator (COMPANY_ADMIN) | Persona — rol privilegiado | Todas las operaciones de la empresa, incluyendo cross-branch |
| Platform Administrator (PLATFORM_ADMIN) | Persona — rol privilegiado | Todas las operaciones de cualquier empresa |
| Reservation Agent (RESERVATION_AGENT) | Persona — rol estándar | Solo lectura |
| Read Only (READ_ONLY) | Persona — rol estándar | Solo lectura |
| Sistema (rentals, reservations) | Sistema interno | Cambio de estado programático via PATCH /fleet/vehicles/{id}/status |
| Google Cloud Storage | Sistema externo | Almacenamiento permanente de fotos |

---

## 3. Catálogo de datos

### DAT-FLT-001: Vehículo

| Campo | Tipo | Obligatorio | Descripción |
| --- | --- | --- | --- |
| id | UUID | Sí (generado) | Identificador único del vehículo |
| organizationId | UUID | Sí | Organización del tenant |
| companyId | UUID | Sí | Empresa propietaria del vehículo |
| branchId | UUID | Sí | Sede a la que está asignado el vehículo |
| plate | string | Sí | Placa del vehículo — única por empresa |
| brand | string | Sí | Marca (ej. Toyota, Hyundai) |
| model | string | Sí | Modelo (ej. Corolla, Tucson) |
| year | integer | Sí | Año de fabricación |
| category | string | Sí | Categoría de flota (ej. Sedan, SUV, Pickup) |
| status | VehicleStatus | Sí | Estado operativo actual (ver §5) |
| assignedBranchId | UUID | No | Sede a la que se asigna si difiere del contexto — solo roles cross-branch pueden establecerla distinta |
| photoUrl | string (HTTPS) | No | URL permanente de la foto almacenada en GCS — solo acepta HTTPS de GCS; rechaza data: URIs |
| dailyRate | decimal | No | Tarifa diaria de referencia |
| notes | string | No | Observaciones internas del vehículo |
| createdAt | DateTime | Sí (generado) | Timestamp de creación |
| updatedAt | DateTime | Sí (generado) | Timestamp de última modificación |

### DAT-FLT-002: Sesión de carga de foto

| Campo | Tipo | Descripción |
| --- | --- | --- |
| uploadUrl | string (HTTPS) | URL firmada de GCS para PUT — válida 15 minutos |
| objectUrl | string (HTTPS) | URL permanente donde quedará almacenado el archivo — se pasa como photoUrl al crear/actualizar el vehículo |
| expiresAt | DateTime | Expiración de la uploadUrl (15 min desde creación) |

### DAT-FLT-003: Parámetros de la sesión de carga

| Campo | Tipo | Obligatorio | Descripción |
| --- | --- | --- | --- |
| contentType | string | Sí | MIME type del archivo — solo `image/jpeg` o `image/webp` |
| contentLength | integer | Sí | Tamaño en bytes — máximo 12 MB (12.582.912 bytes) |

---

## 4. Reglas de negocio

### BR-FLT-001: Placa única por empresa
**Prioridad:** Alta

La combinación `plate + companyId` debe ser única en el sistema. Si se intenta registrar un vehículo con una placa que ya existe para esa empresa, el sistema retorna error 409 Conflict.

### BR-FLT-002: Foto solo vía GCS — prohibido data: URI
**Prioridad:** Alta

El campo `photoUrl` solo acepta URLs HTTPS del dominio de Google Cloud Storage. Se rechaza cualquier URL `data:` o de otro dominio. El flujo obligatorio es:
1. Solicitar URL firmada via `POST /fleet/vehicles/photo-upload-sessions`.
2. Hacer PUT a la `uploadUrl` con el archivo binario.
3. Pasar la `objectUrl` como `photoUrl` al crear o actualizar el vehículo.

### BR-FLT-003: Restricción de formato y tamaño de foto
**Prioridad:** Alta

Solo se aceptan archivos JPEG (`image/jpeg`) o WebP (`image/webp`). El tamaño máximo es 12 MB (12.582.912 bytes). El sistema retorna 400 para `contentType` no permitido y 413 para `contentLength` fuera de rango.

### BR-FLT-004: Aislamiento por sede (IDOR por sede)
**Prioridad:** Crítica

Un Fleet Operator (CAMPO) autenticado en Sede A no puede crear, actualizar ni consultar vehículos de Sede B. El backend valida que `branchId` del vehículo corresponda al contexto del usuario. Solo los roles GERENCIA, ADMINISTRACION y PLATFORM_ADMIN pueden operar con `assignedBranchId` distinto al contexto.

### BR-FLT-005: Idempotencia en mutaciones
**Prioridad:** Alta

Las operaciones `POST /fleet/vehicles`, `PATCH /fleet/vehicles/{id}` y `PATCH /fleet/vehicles/{id}/status` soportan el header `Idempotency-Key`. Si la misma clave ya fue procesada exitosamente, el servidor retorna el resultado anterior sin ejecutar la mutación nuevamente (vía `IdempotencyInterceptor`).

### BR-FLT-006: Estado solo cambia por transición explícita
**Prioridad:** Alta

El campo `status` de un vehículo solo cambia a través del endpoint `PATCH /fleet/vehicles/{id}/status`. No se puede cambiar el estado a través del endpoint de actualización de datos `PATCH /fleet/vehicles/{id}`.

Las transiciones de estado válidas son:

| Desde \ Hacia | AVAILABLE | RENTED | MAINTENANCE | OUT_OF_SERVICE |
| --- | --- | --- | --- | --- |
| AVAILABLE | — | ✅ (reservas/alquileres) | ✅ | ✅ |
| RENTED | ✅ (devolución) | — | ❌ | ❌ |
| MAINTENANCE | ✅ | ❌ | — | ✅ |
| OUT_OF_SERVICE | ✅ | ❌ | ✅ | — |

### BR-FLT-007: Vehículo en RENTED no puede cambiar de sede
**Prioridad:** Alta

Mientras el vehículo tiene estado `RENTED`, no se puede cambiar el campo `assignedBranchId`.

### BR-FLT-008: URL firmada expira en 15 minutos
**Prioridad:** Media

La `uploadUrl` retornada por `POST /fleet/vehicles/photo-upload-sessions` tiene una validez de 15 minutos. Pasado ese tiempo, el PUT a GCS fallará y el cliente debe solicitar una nueva sesión.

### BR-FLT-009: GCS obligatorio para fotos en producción
**Prioridad:** Alta

El endpoint `POST /fleet/vehicles/photo-upload-sessions` retorna 503 si la variable de entorno `GCS_BUCKET_NAME` no está configurada. Las fotos son opcionales en los datos del vehículo, pero si se desea registrar foto el servicio GCS debe estar disponible.

---

## 5. Máquina de estados del vehículo

| Estado | Significado operativo | Transiciones permitidas |
| --- | --- | --- |
| `AVAILABLE` | Disponible para reservar o alquilar | → RENTED, MAINTENANCE, OUT_OF_SERVICE |
| `RENTED` | Actualmente en alquiler activo | → AVAILABLE (solo tras devolución) |
| `MAINTENANCE` | En taller o revisión preventiva | → AVAILABLE, OUT_OF_SERVICE |
| `OUT_OF_SERVICE` | Fuera de operación (accidente, venta pendiente, etc.) | → AVAILABLE, MAINTENANCE |

Estado inicial al registrar un vehículo: `AVAILABLE`.

---

## 6. Escenarios verificables

### SC-FLT-001: Registro exitoso de vehículo

**Dado** que un Fleet Operator autenticado en Sede A envía `POST /fleet/vehicles` con datos válidos
**Y** la placa no existe para esa empresa
**Entonces** el vehículo se crea con estado `AVAILABLE`
**Y** el endpoint retorna 201 con el `VehicleResponse` completo
**Y** el `branchId` del vehículo corresponde al contexto del operador

### SC-FLT-002: Rechazo de placa duplicada

**Dado** que ya existe un vehículo con placa `ABC-123` para la empresa X
**Cuando** el operador intenta registrar otro vehículo con la misma placa
**Entonces** el sistema retorna 409 Conflict
**Y** no se crea ningún registro nuevo

### SC-FLT-003: Carga de foto — flujo GCS completo

**Dado** que el operador solicita `POST /fleet/vehicles/photo-upload-sessions` con contentType=`image/jpeg` y contentLength=2.000.000
**Entonces** el sistema retorna 201 con `uploadUrl` (PUT a GCS) y `objectUrl` (URL permanente)
**Y** el operador hace PUT a `uploadUrl` con el archivo
**Y** el operador pasa `objectUrl` como `photoUrl` al crear el vehículo

### SC-FLT-004: Rechazo de data: URI como photoUrl

**Dado** que el operador envía `photoUrl: "data:image/jpeg;base64,..."` en el request
**Entonces** el sistema retorna 400 Bad Request
**Y** el mensaje de error indica que solo se aceptan URLs HTTPS de GCS

### SC-FLT-005: Rechazo de archivo WebP mayor a 12 MB

**Dado** que el operador solicita una sesión de carga con contentType=`image/webp` y contentLength=13.000.000
**Entonces** el sistema retorna 413 (contentLength supera el límite)

### SC-FLT-006: IDOR — Fleet Operator no puede gestionar vehículo de otra sede

**Dado** que el Fleet Operator está autenticado en Sede A
**Cuando** intenta hacer PATCH sobre un vehículo de Sede B
**Entonces** el sistema retorna 403 Forbidden
**Y** no se modifica el vehículo

### SC-FLT-007: Cambio de estado AVAILABLE → MAINTENANCE

**Dado** que el vehículo tiene estado `AVAILABLE`
**Cuando** el operador envía `PATCH /fleet/vehicles/{id}/status` con `{ status: "MAINTENANCE" }`
**Entonces** el estado cambia a `MAINTENANCE`
**Y** el sistema retorna 200 con el `VehicleResponse` actualizado

### SC-FLT-008: Transición inválida — RENTED a MAINTENANCE

**Dado** que el vehículo tiene estado `RENTED`
**Cuando** se intenta cambiar el estado a `MAINTENANCE`
**Entonces** el sistema retorna 422 Unprocessable Entity
**Y** el estado del vehículo no cambia

### SC-FLT-009: Idempotencia en creación con Idempotency-Key

**Dado** que una solicitud `POST /fleet/vehicles` con `Idempotency-Key: key-123` fue procesada exitosamente
**Cuando** se repite la misma solicitud con la misma clave
**Entonces** el sistema retorna el resultado original sin crear un segundo vehículo
**Y** no hay duplicados en la base de datos

### SC-FLT-010: Listado filtrado por estado

**Dado** que existen vehículos en múltiples estados para la empresa/sede del operador
**Cuando** el operador solicita `GET /fleet/vehicles?status=AVAILABLE`
**Entonces** solo se retornan vehículos con estado `AVAILABLE` de esa empresa/sede
**Y** no se incluyen vehículos de otras sedes ni otras empresas
