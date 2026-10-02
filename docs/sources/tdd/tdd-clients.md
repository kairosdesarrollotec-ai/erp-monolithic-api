---
modulo: Clientes (Customers)
proceso: Gestión del catálogo de clientes de alquiler
version: '1.0'
estado: APROBADO
fecha_aprobacion: '2026-10-01'
autores:
  - Russbel Hernández (BA)
  - Equipo técnico KAIROS
fuentes_base:
  - bdd-clients.md v1.0
  - sdd-clients.md v1.0
  - packages/contracts/openapi/customers.yaml v0.1.0
  - TDD-KAIROS-MVP-002-TRANSVERSAL §Customers
---

## 0. Control de cambios

| Versión | Fecha | Autor | Cambio |
| --- | --- | --- | --- |
| 1.0 | 2026-10-01 | Russbel Hernández | Documento inicial — arquitectura técnica del módulo Customers implementado. |

---

## 1. Stack técnico

El módulo sigue el stack aprobado en TDD-KAIROS-MVP-002-TRANSVERSAL:

- **Runtime:** Node.js 22 LTS
- **Framework:** NestJS
- **ORM:** Prisma (PostgreSQL)
- **Autenticación:** Firebase Authentication (guard `FirebaseAuthGuard`)
- **Contrato API:** `customers.yaml` v0.1.0 (OpenAPI 3.0.3)
- **Testing:** Jest con ESM stubs (TDD-NOT-ADR-002 aplicado)

---

## 2. Estructura del módulo

```
apps/api/src/modules/customers/
├── application/
│   ├── commands/
│   │   ├── create-customer.command.ts
│   │   ├── create-customer.handler.ts
│   │   ├── update-customer.command.ts
│   │   └── update-customer.handler.ts
│   ├── queries/
│   │   ├── get-customer.query.ts
│   │   ├── get-customer.handler.ts
│   │   ├── list-customers.query.ts
│   │   └── list-customers.handler.ts
│   ├── policies/
│   │   └── customer-role.policy.ts
│   └── ports/
│       └── customer-repository.port.ts
├── domain/
│   ├── customer.ts
│   └── customer-errors.ts
├── infrastructure/
│   └── prisma-customer.repository.ts
├── presentation/
│   ├── customers.controller.ts
│   └── dto/
│       ├── create-customer.dto.ts
│       ├── update-customer.dto.ts
│       └── customer-response.dto.ts
└── customers.module.ts
```

---

## 3. Modelo de dominio

### 3.1 Interface Customer

```typescript
export interface Customer {
  id: string;
  organizationId: string;
  operatingCompanyId: string;
  fullName: string;
  documentType: string;
  documentNumber: string;
  nationality?: 'PERUANO' | 'EXTRANJERO' | null;
  countryEntryDate?: Date | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
```

### 3.2 Modelo Prisma

El modelo `Customer` en `schema.prisma` refleja los campos del dominio con un constraint único sobre `(operatingCompanyId, documentType, documentNumber)` para garantizar BR-CLI-001 a nivel de base de datos.

```prisma
model Customer {
  id                String    @id @default(uuid())
  organizationId    String
  operatingCompanyId String
  fullName          String
  documentType      String
  documentNumber    String
  nationality       String?
  countryEntryDate  DateTime?
  email             String?
  phone             String?
  address           String?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  @@unique([operatingCompanyId, documentType, documentNumber])
  @@index([operatingCompanyId])
  @@map("customers")
}
```

---

## 4. Contrato OpenAPI

Fuente: `packages/contracts/openapi/customers.yaml` v0.1.0

### 4.1 Endpoints

| Método | Ruta | Body / Query | Respuesta exitosa | Errores esperados |
| --- | --- | --- | --- | --- |
| POST | /customers | CreateCustomerBody | 201 CustomerResponse | 400, 403, 409 |
| GET | /customers | search?, page?, limit?, companyId, branchId | 200 CustomerListResponse | 403 |
| GET | /customers/{id} | companyId, branchId (query) | 200 CustomerResponse | 403, 404 |
| PATCH | /customers/{id} | UpdateCustomerBody (parcial) | 200 CustomerResponse | 400, 403, 404 |

### 4.2 CustomerResponse schema

```yaml
CustomerResponse:
  type: object
  required: [id, organizationId, operatingCompanyId, fullName, documentType, documentNumber, createdAt, updatedAt]
  properties:
    id:                { type: string, format: uuid }
    organizationId:    { type: string, format: uuid }
    operatingCompanyId: { type: string, format: uuid }
    fullName:          { type: string }
    documentType:      { type: string }
    documentNumber:    { type: string }
    nationality:       { type: string, enum: [PERUANO, EXTRANJERO], nullable: true }
    countryEntryDate:  { type: string, format: date-time, nullable: true }
    email:             { type: string, nullable: true }
    phone:             { type: string, nullable: true }
    address:           { type: string, nullable: true }
    createdAt:         { type: string, format: date-time }
    updatedAt:         { type: string, format: date-time }
```

### 4.3 Códigos de error documentados

| Código HTTP | Código de error | Escenario |
| --- | --- | --- |
| 400 | COUNTRY_ENTRY_DATE_ONLY_FOR_FOREIGNERS | countryEntryDate enviado sin nationality EXTRANJERO |
| 403 | Forbidden | Rol sin permisos de escritura o lectura |
| 404 | CUSTOMER_NOT_FOUND | Cliente no existe o pertenece a otra empresa |
| 409 | CUSTOMER_DOCUMENT_ALREADY_EXISTS | Documento ya registrado en la empresa |

---

## 5. Autorización

### 5.1 Autenticación

Todas las rutas del módulo están protegidas por `FirebaseAuthGuard`. El token Firebase se envía como `Authorization: Bearer <token>`.

### 5.2 Contexto de trabajo

Todas las operaciones requieren `companyId` y `branchId` (query param o body) para resolver el contexto de trabajo via `WorkContextAuthorizationService.authorize()`. El método devuelve `{ organizationId, operatingCompanyId, role }`.

### 5.3 Política de roles

```typescript
// customer-role.policy.ts
const WRITE_ROLES: WorkerRole[] = [
  WorkerRole.GERENCIA,
  WorkerRole.ADMINISTRACION,
  WorkerRole.FRONT_OFFICE,
  WorkerRole.PLATFORM_ADMIN,
];

const READ_ROLES: WorkerRole[] = [
  WorkerRole.GERENCIA,
  WorkerRole.ADMINISTRACION,
  WorkerRole.CAMPO,
  WorkerRole.FRONT_OFFICE,
  WorkerRole.FINANZAS,
  WorkerRole.AUDITORIA,
  WorkerRole.PLATFORM_ADMIN,
];
```

`assertCustomerWrite(role)` y `assertCustomerRead(role)` lanzan `ForbiddenException` si el rol no está en el conjunto correspondiente.

---

## 6. Aislamiento multiempresa

La implementación garantiza el aislamiento a dos niveles:

**Nivel 1 — Aplicación:** `WorkContextAuthorizationService.authorize()` resuelve `operatingCompanyId` desde el token Firebase y el contexto de trabajo del usuario. Los handlers inyectan este valor en todas las operaciones de repositorio, sin confiar en ningún valor enviado por el cliente.

**Nivel 2 — Base de datos:** `PrismaCustomerRepository` incluye `operatingCompanyId` en la cláusula WHERE de todas las queries:

- `findByDocument`: `WHERE organizationId = ? AND operatingCompanyId = ? AND documentType = ? AND documentNumber = ?`
- `findByIdAndCompany`: `WHERE id = ? AND organizationId = ? AND operatingCompanyId = ?`
- `list`: `WHERE operatingCompanyId = ?` (con búsqueda adicional si se proporciona `search`)

**Nivel 3 — Base de datos (unicidad):** El unique constraint `(operatingCompanyId, documentType, documentNumber)` garantiza BR-CLI-001 incluso ante condiciones de carrera.

---

## 7. Testing

### 7.1 Cobertura esperada

| Capa | Tipo de test | Descripción |
| --- | --- | --- |
| Domain | Unit | Validaciones de dominio (BR-CLI-002) |
| Application / Handlers | Unit | CreateCustomerHandler, GetCustomerHandler, ListCustomersHandler, UpdateCustomerHandler — incluyendo casos de error |
| CustomerRolePolicy | Unit | assertCustomerWrite y assertCustomerRead para cada rol |
| PrismaCustomerRepository | Integration | create, findByDocument, findByIdAndCompany, list, update — con base de datos real |
| CustomersController | E2E | POST/GET/PATCH — incluyendo 409, 404, 403 |

### 7.2 Escenarios de test prioritarios

1. `CreateCustomerHandler`: creación exitosa — verifica `organizationId` y `operatingCompanyId` del contexto, no del body.
2. `CreateCustomerHandler`: duplicado → `409 CUSTOMER_DOCUMENT_ALREADY_EXISTS`.
3. `CreateCustomerHandler`: `countryEntryDate` sin `nationality=EXTRANJERO` → `400`.
4. `CreateCustomerHandler`: rol CAMPO → `403 Forbidden`.
5. `GetCustomerHandler`: cliente de otra empresa → `404`.
6. `ListCustomersHandler`: solo devuelve clientes de la empresa del usuario.
7. `CustomerRolePolicy`: todos los roles — verifica WRITE y READ.

### 7.3 Patrón de tests (handlers)

```typescript
function buildDeps(record: Customer | null, opts: { forbidden?: boolean; role?: string } = {}) {
  const customers = {
    findByDocument: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue(record),
    findByIdAndCompany: jest.fn().mockResolvedValue(record),
    list: jest.fn().mockResolvedValue({ data: record ? [record] : [], total: record ? 1 : 0 }),
    update: jest.fn().mockResolvedValue(record),
  };
  const workContext = {
    authorize: jest.fn().mockResolvedValue({
      organizationId: 'org-1',
      companyId: 'c-1',
      role: opts.role ?? 'FRONT_OFFICE',
    }),
  };
  return { customers, workContext };
}
```

---

## 8. Decisiones técnicas

### TDD-CLI-ADR-001 — No hay campo `status` en el MVP

El módulo Customers no implementa un campo `status` (activo/inactivo) en v0.1.0. La baja o inactivación de clientes está fuera del alcance del MVP. Si se requiere en el futuro, se añadirá como una nueva migración con un valor por defecto `ACTIVE`.

### TDD-CLI-ADR-002 — Normalización en la capa de aplicación, no en el DTO

La normalización de `documentType` (uppercase, trim) y `documentNumber` (trim) ocurre en el handler de aplicación, no en el DTO. Esto garantiza que la política de unicidad y la búsqueda de duplicados siempre comparan valores normalizados.

### TDD-CLI-ADR-003 — 404 ante acceso cross-empresa

Cuando un usuario solicita `GET /customers/{id}` y el cliente existe pero pertenece a otra empresa, el sistema devuelve `404 Not Found` (no `403 Forbidden`). Esto evita exponer la existencia del recurso en otra empresa (seguridad por oscuridad complementaria al filtro multiempresa).

---

## 9. Frontend — Pantallas relacionadas

| UX-ID | Nombre | Descripción |
| --- | --- | --- |
| CLI-01 | Bandeja de clientes | Lista paginada, búsqueda, modal de nuevo cliente con flujo de coincidencia DNI |
| CLI-02 | Ficha 360 del cliente | Detalle completo, edición en línea |

Prototipos aprobados: `PROTO-CLI-01-BANDEJA`, `PROTO-CLI-01-COINCIDENCIA-DNI`, `PROTO-CLI-02-FICHA-360-CLIENTE`.

El frontend usa el cliente generado desde `customers.yaml` v0.1.0. Está prohibido construir clientes HTTP manuales o inventar endpoints no documentados.
