---
modulo: Templates (Plantillas de documentos)
proceso: Gestión de plantillas de documentos base
version: '1.0'
estado: APROBADO
fecha_aprobacion: '2026-10-09'
autores:
  - Equipo técnico KAIROS
fuentes_base:
  - Descripción funcional aprobada por Russbel (sesión 2026-10-09, PROP-017)
  - BR-DOC-002 (tdd-03-alquiler §9.3) — contrato de alquiler
  - BR-DEV-009 (bdd-04-devolucion §16.6.7) — documento de responsabilidad
  - ADR-KAI-005 extendido — patrón GCS de URL firmada
---

## 0. Control de cambios

| Versión | Fecha | Autor | Cambio |
|---------|-------|-------|--------|
| 1.0 | 2026-10-09 | Equipo técnico KAIROS | Documento inicial — módulo `templates` standalone con soporte de subida de archivos docx/pdf vía GCS. Consolida los tipos `RENTAL_CONTRACT` (antes en `rentals/contract-templates`) y `RETURN_RESPONSIBILITY` (antes en `document-templates`). |

---

## 1. Control y documentos relacionados

| Campo | Referencia |
|-------|-----------|
| Decisión de implementación | `docs/decision-log.md` (PROP-017) |
| Contrato OpenAPI | `packages/contracts/openapi/templates.yaml` (por crear) |
| Módulo precedente (contract-templates) | `apps/api/src/modules/rentals/presentation/http/contract-templates.controller.ts` |
| Módulo precedente (document-templates) | `apps/api/src/modules/document-templates/` |
| Patrón GCS de referencia | `tdd-fleet.md` TDD-FLT-ADR-001 / PROP-008 |

---

## 2. Objetivo y alcance técnico

Proveer un módulo standalone `templates` que permita a cada empresa del Grupo KAIROS gestionar sus plantillas de documentos base (docx/pdf): contratos de reserva, contratos de alquiler, documentos de responsabilidad en devolución y otros tipos futuros. Cada empresa mantiene exactamente una versión `ACTIVE` por tipo; crear una nueva versión retira automáticamente la anterior.

**Fuera de alcance v1.0:**
- Renderizado o llenado de variables en el documento (merge fields).
- Firma electrónica del documento base (distinto de la firma del cliente en `complete-inspection`).
- Versionado histórico navegable desde el frontend (lista solo versiones activas + retiradas por tipo, no diff de contenido).

---

## 3. Decisiones técnicas

### TDD-TPL-ADR-001: Subida de archivo vía URL firmada GCS (ADR-KAI-005)

**Decisión:** Los documentos base (docx/pdf) se suben directamente a GCS desde el cliente. El backend genera la URL firmada PUT y valida que `documentUrl` sea una URL HTTPS de GCS antes de marcar la plantilla como lista.

**Razón:** Mismo razonamiento que TDD-FLT-ADR-001 — archivos de hasta 20 MB no transitan por el API gateway.

**Flujo de tres pasos:**
1. `POST /templates` — crea el registro de metadatos (`status: DRAFT`). Devuelve `id`.
2. `POST /templates/{id}/upload-url` — genera signed PUT URL (validez 15 min). Cliente sube el archivo directamente a GCS.
3. `POST /templates/{id}/commands/activate` — valida que `documentUrl` esté presente, activa la versión y retira la anterior (`status: RETIRED`) de manera atómica.

**Prefijo GCS:** `templates/{companyId}/{type}/`

**MIME types permitidos:** `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (docx).

**Tamaño máximo:** 20 MB.

### TDD-TPL-ADR-002: Módulo standalone, no dentro de `rentals`

**Decisión:** `templates` es un módulo independiente con su propio port `TemplateRepositoryPort` y `TemplateStoragePort`. El módulo `rentals` importa `TemplatesModule` y consulta la plantilla activa a través de `TemplateRepositoryPort.findActive(companyId, type)`.

**Razón:** El tipo `RENTAL_CONTRACT` ya existe en `ContractTemplate` (módulo `rentals`). La nueva entidad `Template` lo consolida junto con `RETURN_RESPONSIBILITY` y tipos futuros. El modelo de `ContractTemplate` en `rentals` queda DEPRECADO para escritura nueva (no se elimina en v1.0 por la FK con `rental_contracts`); `formalize-contract` puede migrar a consultar `TemplateRepositoryPort` en una segunda fase.

### TDD-TPL-ADR-003: Una versión ACTIVE por (companyId, type)

**Decisión:** Restricción de base de datos: índice único parcial sobre `(company_id, type)` donde `status = 'ACTIVE'`. No se puede activar una nueva versión sin retirar la anterior — ambas operaciones ocurren en la misma transacción.

**Razón:** BR-DOC-002 — solo una plantilla vigente por tipo por empresa.

### TDD-TPL-ADR-004: Autorización por rol — MANAGE_TEMPLATES

**Decisión:** Los endpoints de escritura (`POST /templates`, `POST /templates/{id}/upload-url`, `POST /templates/{id}/commands/activate`) requieren permiso `TEMPLATE.MANAGE` en la matriz de autorización. Los endpoints de lectura (`GET /templates`, `GET /templates/{id}`) requieren `TEMPLATE.VIEW`.

**Roles típicos con `TEMPLATE.MANAGE`:** `OPS_MANAGER`, `COMPANY_ADMIN`.

---

## 4. Modelo de dominio

### 4.1 Entidad `Template`

| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | UUID PK | |
| `organizationId` | String | FK a `organizations` — aislamiento multiempresa |
| `companyId` | String | FK a `companies` |
| `type` | String varchar(50) | Ver §4.2 |
| `name` | String varchar(200) | Nombre descriptivo libre |
| `version` | Int | Auto-incrementado por `(companyId, type)` al activar |
| `status` | String | `DRAFT` \| `ACTIVE` \| `RETIRED` |
| `documentUrl` | String? | URL pública GCS (https://storage.googleapis.com/…) |
| `documentFormat` | String? | `PDF` \| `DOCX` |
| `effectiveFrom` | DateTime? | Fecha desde la que aplica (informativo) |
| `createdAt` | DateTime | |
| `createdBy` | String | Firebase UID |
| `updatedAt` | DateTime | |
| `updatedBy` | String | Firebase UID |

**Índices:**
- `UNIQUE PARTIAL (company_id, type) WHERE status = 'ACTIVE'`
- `INDEX (company_id, type)`
- `INDEX (organization_id)`

**Invariantes de dominio:**
1. Una sola versión `ACTIVE` por `(companyId, type)` en todo momento.
2. `documentUrl` es obligatorio para activar una plantilla.
3. Una vez `RETIRED`, una plantilla no puede cambiar de estado.
4. El número `version` no es editable; lo asigna el sistema al activar.

### 4.2 Tipos de plantilla (`TemplateType`)

| Tipo | Descripción | Módulo consumidor |
|------|-------------|------------------|
| `RENTAL_CONTRACT` | Contrato de alquiler de vehículo | `rentals` / `formalize-contract` |
| `RESERVATION_CONTRACT` | Contrato de reserva de vehículo | `reservations` (fase futura) |
| `RETURN_RESPONSIBILITY` | Documento de responsabilidad en devolución | `returns` / `complete-inspection` |

El campo `type` es `varchar(50)` — extensible sin migración.

---

## 5. Arquitectura de módulo

```
apps/api/src/modules/templates/
├── domain/
│   ├── template-type.ts                      # constantes TemplateType
│   └── template-errors.ts                    # TemplateNotFoundError, TemplateDraftRequiredError
├── application/
│   ├── ports/
│   │   ├── template-repository.port.ts       # findActive, findById, create, updateStatus, nextVersion
│   │   └── template-storage.port.ts          # generateSignedUploadUrl, generateSignedReadUrl
│   ├── commands/
│   │   ├── create-template.{command,handler}.ts
│   │   ├── request-template-upload-url.{command,handler}.ts
│   │   └── activate-template.{command,handler}.ts
│   └── queries/
│       ├── list-templates.{query,handler}.ts
│       └── get-template.{query,handler}.ts
├── infrastructure/
│   ├── persistence/
│   │   └── prisma-template.repository.ts
│   └── storage/
│       └── gcs-template.service.ts           # implements TemplateStoragePort
├── presentation/
│   └── http/
│       ├── templates.controller.ts
│       ├── template.mapper.ts
│       └── dto/
│           ├── create-template.dto.ts
│           ├── activate-template.dto.ts
│           ├── list-templates-query.dto.ts
│           ├── template.response.ts
│           └── template-upload-url.response.ts
└── templates.module.ts
```

---

## 6. Contrato HTTP

> Prefijo: `/api/v1/templates`

### 6.1 Crear plantilla (borrador)

```
POST /api/v1/templates
Idempotency-Key: <uuid>
```

```json
{
  "companyId": "uuid",
  "branchId": "uuid",
  "type": "RENTAL_CONTRACT",
  "name": "Contrato de alquiler VeloxRent v2",
  "effectiveFrom": "2026-11-01T00:00:00-05:00"
}
```

Respuesta `201`:
```json
{
  "id": "uuid",
  "type": "RENTAL_CONTRACT",
  "name": "Contrato de alquiler VeloxRent v2",
  "version": null,
  "status": "DRAFT",
  "documentUrl": null,
  "documentFormat": null,
  "effectiveFrom": "2026-11-01T00:00:00-05:00",
  "createdAt": "2026-10-09T10:00:00-05:00"
}
```

### 6.2 Solicitar URL de subida

```
POST /api/v1/templates/{id}/upload-url
Idempotency-Key: <uuid>
```

```json
{
  "companyId": "uuid",
  "branchId": "uuid",
  "contentType": "application/pdf",
  "contentLength": 245000
}
```

Respuesta `201`:
```json
{
  "uploadUrl": "https://storage.googleapis.com/kairos-bucket/templates/...?X-Goog-Signature=...",
  "objectUrl": "https://storage.googleapis.com/kairos-bucket/templates/.../v_draft.pdf",
  "expiresAt": "2026-10-09T10:15:00-05:00"
}
```

> El cliente hace `PUT {uploadUrl}` con el archivo y el header `Content-Type` correspondiente.
> Tras el PUT exitoso, llama a `activate`.

### 6.3 Activar plantilla

```
POST /api/v1/templates/{id}/commands/activate
Idempotency-Key: <uuid>
```

```json
{
  "companyId": "uuid",
  "branchId": "uuid",
  "objectUrl": "https://storage.googleapis.com/kairos-bucket/templates/.../v_draft.pdf",
  "documentFormat": "PDF"
}
```

Respuesta `200`:
```json
{
  "id": "uuid",
  "type": "RENTAL_CONTRACT",
  "name": "Contrato de alquiler VeloxRent v2",
  "version": 3,
  "status": "ACTIVE",
  "documentUrl": "https://storage.googleapis.com/...",
  "documentFormat": "PDF",
  "effectiveFrom": "2026-11-01T00:00:00-05:00",
  "createdAt": "2026-10-09T10:00:00-05:00"
}
```

Errores:
- `409 TEMPLATE_DRAFT_REQUIRED` — la plantilla ya no está en `DRAFT`.
- `422 MISSING_DOCUMENT_URL` — `objectUrl` no es una URL GCS válida.

### 6.4 Listar plantillas

```
GET /api/v1/templates?companyId=uuid&branchId=uuid&type=RENTAL_CONTRACT&status=ACTIVE
```

Respuesta `200`: array de `TemplateResponse`.

Parámetros opcionales: `type` (filtra por tipo), `status` (default: todos).

### 6.5 Obtener plantilla

```
GET /api/v1/templates/{id}?companyId=uuid&branchId=uuid
```

Respuesta `200`: `TemplateResponse` (igual que en `activate`).

> El campo `documentUrl` devuelve la URL pública de GCS. Para documentos sensibles, en una fase futura este campo puede devolver una URL firmada de lectura (15 min validez) en lugar de la URL permanente.

---

## 7. Variables de entorno

| Variable | Descripción |
|----------|-------------|
| `GCS_BUCKET_NAME` | Bucket GCS (mismo que en fleet y returns) |
| `GCS_CREDENTIALS_JSON` | Credenciales de servicio GCS |
| `TEMPLATES_UPLOAD_MAX_BYTES` | Tamaño máximo de archivo (default: `20971520` = 20 MB) |

---

## 8. Migración Prisma

Nueva tabla `templates`. La tabla `contract_templates` existente **no se elimina** en esta versión — sigue siendo la fuente de `templateVersionId` en `rental_contracts`. Se marca como DEPRECADA en el schema con un comentario; su eliminación requiere una migración separada que migre los FK y actualice `formalize-contract`.

---

## 9. Relación con módulos existentes

| Módulo | Interacción |
|--------|------------|
| `rentals` | Importa `TemplatesModule`; `formalize-contract` consultará `TemplateRepositoryPort.findActive(companyId, 'RENTAL_CONTRACT')` en fase 2 |
| `returns` | `GetResponsibilityTemplateHandler` en `returns` puede migrar a `TemplateRepositoryPort.findActive(companyId, 'RETURN_RESPONSIBILITY')` |
| `reservations` | Consumirá `RESERVATION_CONTRACT` cuando sea relevante |

---

## 10. Pendientes y deuda técnica

| ID | Descripción | Prioridad |
|----|-------------|-----------|
| TPL-TODO-001 | Migrar `formalize-contract` para usar `TemplateRepositoryPort` en lugar de `ContractTemplate` directo | Media |
| TPL-TODO-002 | Deprecar `ContractTemplatesController` en `rentals` y migrar FK `rental_contracts.template_version_id` | Baja — requiere migración de datos |
| TPL-TODO-003 | URL firmada de lectura en `GET /templates/{id}` para documentos sensibles | Baja |
| TPL-TODO-004 | Pantalla de gestión de plantillas en el frontend (ADM-03) — requiere prototipo aprobado | Pendiente UX |
