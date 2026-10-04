---
modulo: Flota (Fleet)
proceso: Gestión del catálogo de vehículos
version: '1.1'
estado: APROBADO
fecha_aprobacion: '2026-10-03'
autores:
  - Equipo técnico KAIROS
fuentes_base:
  - bdd-fleet.md v1.0
  - sdd-fleet.md v1.0
  - packages/contracts/openapi/fleet.yaml v0.3.0
  - artifacts/traceability/fleet/FLOTA-01-traceability.md
---

## 0. Control de cambios

| Versión | Fecha | Autor | Cambio |
| --- | --- | --- | --- |
| 1.0 | 2026-10-01 | Equipo técnico KAIROS | Documento inicial — arquitectura técnica del módulo Fleet. Refleja el estado mergeado a main (PR #51 frontend, PR #37 backend). Tests: 22/22 frontend (10 component + 12 client MSW). |
| 1.1 | 2026-10-03 | Equipo técnico KAIROS | Bug 8 — campo `depositMinimum` en modelo Vehicle y contrato fleet.yaml v0.3.0. |

---

## 1. Control y documentos relacionados

| Campo | Referencia |
| --- | --- |
| BDD | bdd-fleet.md v1.0 |
| SDD | sdd-fleet.md v1.0 |
| Contrato OpenAPI | packages/contracts/openapi/fleet.yaml v0.3.0 |
| Trazabilidad | artifacts/traceability/fleet/FLOTA-01-traceability.md |
| PR backend mergeado | #37 (feat/fleet-gcs-photo-upload → main) |
| PR frontend mergeado | #51 (feat/fleet-gcs-photo-upload → main) |
| Tests frontend | 22/22 passing (10 component + 12 client con MSW v2) |

---

## 2. Objetivo y alcance técnico

Definir la implementación técnica del módulo `fleet` del backend NestJS y del slice `fleet` del frontend React: estructura de módulo, modelo de dominio, contrato OpenAPI, flujo GCS de foto, cliente generado, componentes de UI y estrategia de testing.

---

## 3. Decisiones técnicas

### TDD-FLT-ADR-001: Foto vía URL firmada GCS (ADR-KAI-005 extendido a Fleet — PROP-008)

**Decisión:** Las fotos de vehículos se cargan directamente a GCS desde el cliente. El backend solo genera la URL firmada y luego valida que `photoUrl` sea una URL HTTPS de GCS.

**Razón:** Las imágenes de hasta 12 MB no transitan por el API gateway NestJS (evita límites de payload y sobrecarga del servidor). GCS gestiona el almacenamiento y la entrega.

**Implementación:**
- `POST /fleet/vehicles/photo-upload-sessions` → genera signed PUT URL (15 min validez)
- Cliente hace PUT con el archivo directamente a GCS
- Cliente pasa `objectUrl` como `photoUrl` en la creación/actualización del vehículo

### TDD-FLT-ADR-002: Validación MIME explícita en frontend

**Decisión:** El frontend valida `contentType` (image/jpeg | image/webp) con una lista explícita antes de solicitar la URL firmada, sin depender de la validación del backend como única barrera.

**Razón:** Mejora la experiencia de usuario (feedback inmediato sin round-trip al servidor); el backend sigue siendo la barrera definitiva.

### TDD-FLT-ADR-003: Permisos PROVISIONAL via fleet-role.policy.ts

**Decisión:** Los permisos de flota se implementan en `fleet-role.policy.ts` con los roles del negocio mapeados a los roles canónicos del sistema (SDD-KAIROS-TRANSVERSAL §15.5). Marcados como PROVISIONAL en el contrato hasta implementar ADM-02.

**Razón:** ADM-02 (gestión de roles en UI) no está en scope del MVP fase 1. Los roles son funcionales y correctos; PROVISIONAL solo indica que la UI de gestión de roles no está disponible aún.

### TDD-FLT-ADR-004: MSW v2 para mocks de API en tests de frontend

**Decisión:** Los tests de cliente de flota usan MSW v2 (`@mswjs/msw`) con el pattern `http.get()/http.post()` de la nueva API.

**Razón:** MSW v2 es la versión estable actual; sus handlers son compatibles con el worker del frontend (Vite) y con el servidor de Node para tests Vitest.

---

## 4. Tabla de trazabilidad

| BDD | SDD | TDD | Código | Test |
| --- | --- | --- | --- | --- |
| BR-FLT-001 (placa única) | §5.3 VehicleService validateUnique | TDD-FLT-ADR-001 | vehicle.service.ts | vehicle.service.spec.ts |
| BR-FLT-002 (foto solo GCS) | §5.4 GcsPhotoUploadService | TDD-FLT-ADR-001 | gcs-photo-upload.service.ts | gcs-photo-upload.service.spec.ts |
| BR-FLT-003 (MIME + tamaño) | §5.4 GcsPhotoUploadService | TDD-FLT-ADR-002 | gcs-photo-upload.service.ts | gcs-photo-upload.service.spec.ts |
| BR-FLT-004 (IDOR por sede) | §5.2 FleetRolePolicy | TDD-FLT-ADR-003 | fleet-role.policy.ts | fleet-role.policy.spec.ts |
| BR-FLT-005 (idempotencia) | §5.1 FleetController | Transversal | IdempotencyInterceptor | integration tests |
| BR-FLT-006 (transición explícita) | §6.2 VehicleService changeStatus | TDD-FLT-ADR-001 | vehicle.service.ts | vehicle.service.spec.ts |
| SC-FLT-001 | §6.1 flujo crear | TDD-FLT-ADR-001 | fleet.controller.ts | fleet.controller.spec.ts |
| SC-FLT-003 (flujo foto) | §6.1 GCS flow | TDD-FLT-ADR-001 | gcs-photo-upload.service.ts | fleet-client.spec.ts (MSW) |
| SC-FLT-006 (IDOR) | §5.2 assertCrossBranchAllowed | TDD-FLT-ADR-003 | fleet-role.policy.ts | fleet-role.policy.spec.ts |
| FLO-01 (UI) | §7 estados UI | TDD-FLT-ADR-004 | FleetListScreen.tsx | FleetListScreen.spec.tsx |

---

## 5. Arquitectura backend — módulo Fleet

### 5.1 Estructura de archivos

```
apps/api/src/modules/fleet/
├── domain/
│   ├── vehicle.ts                       # Entidad Vehicle + VehicleStatus enum
│   └── vehicle-status-transition.ts     # Regla de transiciones válidas
├── application/
│   ├── commands/
│   │   ├── create-vehicle.command.ts
│   │   ├── update-vehicle.command.ts
│   │   └── change-vehicle-status.command.ts
│   ├── queries/
│   │   └── list-vehicles.query.ts
│   └── ports/
│       ├── vehicle-repository.port.ts
│       └── photo-upload.port.ts
├── infrastructure/
│   ├── persistence/
│   │   └── prisma-vehicle.repository.ts
│   ├── gcs/
│   │   └── gcs-photo-upload.service.ts
│   └── policy/
│       └── fleet-role.policy.ts
├── presentation/
│   ├── fleet.controller.ts
│   └── dto/
│       ├── create-vehicle.request.dto.ts
│       ├── update-vehicle.request.dto.ts
│       ├── change-vehicle-status.request.dto.ts
│       ├── photo-upload-session.request.dto.ts
│       └── vehicle.response.dto.ts
└── fleet.module.ts
```

### 5.2 Modelo Prisma (vehicles)

```prisma
model Vehicle {
  id               String        @id @default(uuid())
  organizationId   String
  companyId        String
  branchId         String
  assignedBranchId String?
  plate            String
  brand            String
  model            String
  year             Int
  category         String
  status           VehicleStatus @default(AVAILABLE)
  photoUrl         String?
  dailyRate        Decimal?      @db.Decimal(10, 2)
  depositMinimum   Decimal?      @db.Decimal(12, 2)
  notes            String?
  createdAt        DateTime      @default(now())
  updatedAt        DateTime      @updatedAt

  @@unique([companyId, plate])
  @@index([companyId, branchId, status])
  @@index([organizationId])
}

enum VehicleStatus {
  AVAILABLE
  RENTED
  MAINTENANCE
  OUT_OF_SERVICE
}
```

### 5.3 Contrato OpenAPI

Archivo: `packages/contracts/openapi/fleet.yaml` v0.3.0

Operaciones documentadas:
- `POST /fleet/vehicles/photo-upload-sessions` → 201 PhotoUploadSessionResponse | 400 | 401 | 403 | 413 | 503
- `POST /fleet/vehicles` → 201 VehicleResponse | 400 | 401 | 403 | 409 (placa duplicada)
- `GET /fleet/vehicles` → 200 VehicleListResponse | 401 | 403
- `GET /fleet/vehicles/{id}` → 200 VehicleResponse | 401 | 403 | 404
- `PATCH /fleet/vehicles/{id}` → 200 VehicleResponse | 400 | 401 | 403 | 404
- `PATCH /fleet/vehicles/{id}/status` → 200 VehicleResponse | 400 | 401 | 403 | 404 | 422 (transición inválida)

---

## 6. Arquitectura frontend — slice Fleet

### 6.1 Estructura de archivos

```
apps/erp-portal-web/apps/web/src/
├── features/fleet/
│   ├── FleetListScreen.tsx              # Pantalla principal FLO-01
│   ├── FleetListScreen.spec.tsx         # Tests de componente (Testing Library)
│   ├── components/
│   │   ├── NewVehicleModal.tsx          # Modal de registro (RHF + Zod)
│   │   └── VehicleStatusBadge.tsx
│   ├── hooks/
│   │   └── useFleetList.ts              # TanStack Query v5 — GET /fleet/vehicles
│   └── schemas/
│       └── vehicle.schema.ts            # Esquema Zod para validación del formulario
├── api/fleet/
│   └── fleet-client.ts                  # Cliente generado desde OpenAPI fleet.yaml
│   └── fleet-client.spec.ts             # Tests de cliente con MSW v2
└── __mocks__/
    └── handlers/
        └── fleet.handlers.ts            # MSW handlers para tests de fleet
```

### 6.2 Stack de componentes

| Capa | Librería | Uso en Fleet |
| --- | --- | --- |
| Estado remoto | TanStack Query v5 | `useFleetList` con `useQuery` |
| Formularios | React Hook Form | `NewVehicleModal` — register, handleSubmit |
| Validación | Zod | `vehicleSchema` — placa, marca, modelo, año, categoría |
| UI primitivas | Radix UI | Dialog (modal), Select (categoría/estado), Table |
| Estilos | CSS Modules | `FleetListScreen.module.css` |
| Íconos | Lucide React | PlusCircle, Edit, Camera, AlertTriangle |
| HTTP client | Cliente generado desde fleet.yaml | `FleetApi` |
| Mocks (tests) | MSW v2 | `fleet.handlers.ts` |

### 6.3 useFleetList

```typescript
// TanStack Query v5 — invoca GET /fleet/vehicles
function useFleetList(params: { companyId: string; branchId: string; status?: VehicleStatus }) {
  return useQuery({
    queryKey: ['fleet', 'vehicles', params],
    queryFn: () => fleetApi.listVehicles(params),
  });
}
```

### 6.4 NewVehicleModal — flujo foto GCS

```typescript
// 1. Usuario selecciona foto → validar MIME explícito (image/jpeg | image/webp)
// 2. POST /fleet/vehicles/photo-upload-sessions {contentType, contentLength}
// 3. PUT uploadUrl (fetch directo a GCS con el archivo)
// 4. Guardar objectUrl en el estado del formulario
// 5. POST /fleet/vehicles {photoUrl: objectUrl, ...demás campos}
```

---

## 7. Guía de testing

### 7.1 Tests de componente (FleetListScreen.spec.tsx)

| Test | Descripción |
| --- | --- |
| renders loading state | Muestra skeleton mientras useQuery está loading |
| renders vehicle list | Muestra filas de vehículos al recibir datos |
| renders empty state | Muestra mensaje vacío cuando data=[] |
| opens new vehicle modal | Botón "Registrar Vehículo" abre NewVehicleModal |
| validates required fields | RHF + Zod valida placa, marca, modelo, año, categoría |
| shows MIME error on invalid file type | Rechazo explícito de PNG/PDF en input de foto |
| submits vehicle with photo | Flujo completo: session → PUT GCS → create vehicle |
| shows status badge correctly | AVAILABLE, RENTED, MAINTENANCE, OUT_OF_SERVICE con colores correctos |
| handles API error gracefully | Muestra toast de error cuando el API falla |
| preserves filters on modal close | Los filtros activos no se pierden al cerrar el modal |

### 7.2 Tests de cliente (fleet-client.spec.ts con MSW v2)

| Test | Handler MSW | Verificación |
| --- | --- | --- |
| createVehicle — 201 | POST /fleet/vehicles → VehicleResponse | retorna vehículo creado |
| createVehicle — 409 | POST /fleet/vehicles → 409 | lanza error con código 409 |
| listVehicles — filtros | GET /fleet/vehicles?status=AVAILABLE | retorna solo vehículos AVAILABLE |
| requestPhotoUploadSession — 201 | POST /photo-upload-sessions → session | retorna uploadUrl y objectUrl |
| requestPhotoUploadSession — 413 | POST /photo-upload-sessions → 413 | lanza error con código 413 |
| changeVehicleStatus — MAINTENANCE | PATCH /{id}/status → 200 | retorna vehículo con status MAINTENANCE |
| changeVehicleStatus — 422 inválida | PATCH /{id}/status → 422 | lanza error con código 422 |
| updateVehicle — 200 | PATCH /{id} → VehicleResponse | retorna vehículo actualizado |
| getVehicle — 404 | GET /{id} → 404 | lanza error con código 404 |
| Idempotency-Key enviado | POST /fleet/vehicles con header | header presente en el request |
| IDOR 403 otra sede | POST /fleet/vehicles → 403 | lanza error con código 403 |
| GCS 503 no configurado | POST /photo-upload-sessions → 503 | lanza error con código 503 |

**Total: 22 tests (10 componente + 12 cliente)**

---

## 8. Modelo de dominio frontend

### VehicleStatus (enum)
```typescript
export enum VehicleStatus {
  AVAILABLE = 'AVAILABLE',
  RENTED = 'RENTED',
  MAINTENANCE = 'MAINTENANCE',
  OUT_OF_SERVICE = 'OUT_OF_SERVICE',
}
```

### VehicleResponse
```typescript
interface VehicleResponse {
  id: string;
  organizationId: string;
  companyId: string;
  branchId: string;
  plate: string;
  brand: string;
  model: string;
  year: number;
  category: string;
  status: VehicleStatus;
  photoUrl?: string;
  dailyRate?: number;
  depositMinimum?: number | null;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
```

### CreateVehicleRequest / UpdateVehicleRequest (adición Bug 8)
```typescript
// Campo adicional en ambos DTOs
depositMinimum?: number;  // validación Zod: z.number().min(0).optional()
```

### vehicleSchema (Zod)
```typescript
const vehicleSchema = z.object({
  plate: z.string().min(1).max(10).regex(/^[A-Z0-9-]+$/),
  brand: z.string().min(1).max(50),
  model: z.string().min(1).max(50),
  year: z.number().int().min(1990).max(new Date().getFullYear() + 1),
  category: z.enum(['Sedan', 'SUV', 'Pickup', 'Van', 'Moto', 'Otro']),
  photoUrl: z.string().url().optional(),
  dailyRate: z.number().positive().optional(),
  depositMinimum: z.number().min(0).optional(),
  notes: z.string().max(500).optional(),
});
```

---

## 9. Registro de cambios posteriores al documento inicial

### Bug 8 — depositMinimum (2026-10-03)

- Prisma: `depositMinimum Decimal? @db.Decimal(12,2)` en el modelo `Vehicle`.
- Migración: `20261003_vehicles_deposit_minimum` — `ALTER TABLE vehicles ADD COLUMN deposit_minimum DECIMAL(12,2) NULL;`
- OpenAPI: `fleet.yaml` v0.3.0 — campo `depositMinimum` en `CreateVehicleRequest`, `UpdateVehicleRequest`, `VehicleResponse` (nullable).
- Frontend: `NewVehicleModal.tsx` campo "Garantía mínima (S/)", validación Zod opcional ≥ 0.
- Tests: `SC-FLT-011`, `SC-FLT-012`.
