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
  - packages/contracts/openapi/customers.yaml v0.1.0
  - SDD-KAIROS-MVP-002-TRANSVERSAL §Customers
---

## 0. Control de cambios

| Versión | Fecha | Autor | Cambio |
| --- | --- | --- | --- |
| 1.0 | 2026-10-01 | Russbel Hernández | Documento inicial — diseño funcional del módulo Customers implementado. |

---

## 1. Visión general

El módulo **Customers** gestiona el catálogo de clientes de alquiler del Grupo KAIROS. Cada empresa tiene su propio catálogo aislado — un cliente registrado en VeloxRent no es visible para Casa del Auto ni para Motrix.

El módulo expone operaciones CRUD básicas: crear, listar, obtener por ID y actualizar. No existe eliminación de clientes en el MVP.

---

## 2. Componentes del módulo

### 2.1 CustomersController

Punto de entrada HTTP del módulo. Delega en los handlers de aplicación.

Rutas expuestas (prefijo `/customers`):

| Método | Ruta | Handler | Descripción |
| --- | --- | --- | --- |
| POST | / | CreateCustomerHandler | Crear nuevo cliente |
| GET | / | ListCustomersHandler | Listar clientes con búsqueda y paginación |
| GET | /:id | GetCustomerHandler | Obtener ficha completa de un cliente |
| PATCH | /:id | UpdateCustomerHandler | Actualizar datos de un cliente |

Guards activos en todas las rutas: `FirebaseAuthGuard`.

---

### 2.2 Handlers de aplicación

#### CreateCustomerHandler

Orquesta la creación de un cliente nuevo.

Flujo:
1. Valida que `countryEntryDate` no se envíe si `nationality !== 'EXTRANJERO'` → `400 COUNTRY_ENTRY_DATE_ONLY_FOR_FOREIGNERS`.
2. Llama `WorkContextAuthorizationService.authorize()` para resolver `organizationId`, `operatingCompanyId` y `role`.
3. Llama `assertCustomerWrite(role)` → `403 Forbidden` si el rol no puede escribir.
4. Normaliza `documentType` (uppercase, trim) y `documentNumber` (trim).
5. Busca duplicado via `CustomerRepositoryPort.findByDocument(documentType, documentNumber, { organizationId, operatingCompanyId })`.
6. Si existe duplicado: lanza `CustomerDocumentAlreadyExistsError` → `409 CUSTOMER_DOCUMENT_ALREADY_EXISTS`.
7. Llama `CustomerRepositoryPort.create()` con todos los campos normalizados.
8. Captura `Prisma.PrismaClientKnownRequestError P2002` (race condition de unicidad) → convierte también a `409`.

#### ListCustomersHandler

Orquesta el listado filtrado de clientes.

Flujo:
1. `WorkContextAuthorizationService.authorize()`.
2. `assertCustomerRead(role)` → `403` si no puede leer.
3. Llama `CustomerRepositoryPort.list({ organizationId, operatingCompanyId, search, page, limit })`.
4. Devuelve `{ data: Customer[], total: number }`.

#### GetCustomerHandler

Orquesta la obtención de la ficha completa de un cliente.

Flujo:
1. `WorkContextAuthorizationService.authorize()`.
2. `assertCustomerRead(role)`.
3. `CustomerRepositoryPort.findByIdAndCompany(id, { organizationId, operatingCompanyId })`.
4. Si no existe o pertenece a otra empresa: `404 Not Found`.

#### UpdateCustomerHandler

Orquesta la actualización parcial de un cliente.

Flujo:
1. Valida BR-CLI-002 si se envía `countryEntryDate`.
2. `WorkContextAuthorizationService.authorize()`.
3. `assertCustomerWrite(role)`.
4. `CustomerRepositoryPort.findByIdAndCompany(id, { organizationId, operatingCompanyId })` → `404` si no existe.
5. `CustomerRepositoryPort.update(id, data)`.

---

### 2.3 CustomerRepositoryPort (puerto)

Interfaz del repositorio de clientes. Abstrae el acceso a datos.

```typescript
interface CustomerRepositoryPort {
  create(data: CreateCustomerData): Promise<Customer>;
  findByDocument(
    documentType: string,
    documentNumber: string,
    scope: { organizationId: string; operatingCompanyId: string }
  ): Promise<Customer | null>;
  findByIdAndCompany(
    id: string,
    scope: { organizationId: string; operatingCompanyId: string }
  ): Promise<Customer | null>;
  list(query: CustomerListQuery): Promise<{ data: Customer[]; total: number }>;
  update(id: string, data: Partial<UpdateCustomerData>): Promise<Customer>;
}
```

---

### 2.4 PrismaCustomerRepository (adaptador)

Implementación del puerto usando Prisma y PostgreSQL.

Consideraciones de aislamiento:
- `findByDocument`: filtra por `organizationId + operatingCompanyId + documentType + documentNumber`.
- `findByIdAndCompany`: filtra por `id + organizationId + operatingCompanyId`.
- `list`: siempre incluye `WHERE operatingCompanyId = ?` en la query.
- `list.search`: busca con `icontains` en `fullName`, `documentNumber` o combinado `documentType + documentNumber`.

---

### 2.5 CustomerRolePolicy

Política estática de autorización por rol para el módulo Customers.

```
WRITE_ROLES = { GERENCIA, ADMINISTRACION, FRONT_OFFICE, PLATFORM_ADMIN }
READ_ROLES  = { GERENCIA, ADMINISTRACION, CAMPO, FRONT_OFFICE, FINANZAS, AUDITORIA, PLATFORM_ADMIN }
```

Funciones exportadas:
- `assertCustomerWrite(role: WorkerRole)`: lanza `ForbiddenException` si el rol no está en `WRITE_ROLES`.
- `assertCustomerRead(role: WorkerRole)`: lanza `ForbiddenException` si el rol no está en `READ_ROLES`.

---

### 2.6 Errores de dominio

| Error | Código HTTP | Código de error | Descripción |
| --- | --- | --- | --- |
| CustomerDocumentAlreadyExistsError | 409 | CUSTOMER_DOCUMENT_ALREADY_EXISTS | Documento ya registrado en la empresa |
| CustomerNotFoundError | 404 | CUSTOMER_NOT_FOUND | Cliente no existe o no pertenece a la empresa |

---

## 3. Flujos principales

### 3.1 Flujo: Crear cliente

```
Frontend → POST /customers (con idToken, companyId, branchId en headers/body)
  → CustomersController.create()
    → CreateCustomerCommand { firebaseUid, companyId, branchId, fullName, documentType, documentNumber, nationality?, countryEntryDate?, email?, phone?, address? }
    → CreateCustomerHandler.execute(command)
      1. Valida countryEntryDate vs nationality (BR-CLI-002)
      2. workContext.authorize() → { organizationId, operatingCompanyId, role }
      3. assertCustomerWrite(role)
      4. Normaliza documentType y documentNumber
      5. customers.findByDocument() → null OK / existe → 409
      6. customers.create() → Customer
      → CustomerResponse (201)
```

### 3.2 Flujo: Listar clientes con búsqueda

```
Frontend → GET /customers?search=juan&page=1&limit=20&companyId=...&branchId=...
  → CustomersController.list()
    → ListCustomersQuery { firebaseUid, companyId, branchId, search?, page?, limit? }
    → ListCustomersHandler.execute(query)
      1. workContext.authorize()
      2. assertCustomerRead(role)
      3. customers.list({ organizationId, operatingCompanyId, search, page, limit })
      → { data: CustomerResponse[], total: number }
```

### 3.3 Flujo: Obtener ficha 360

```
Frontend → GET /customers/:id?companyId=...&branchId=...
  → CustomersController.getById()
    → GetCustomerQuery { firebaseUid, companyId, branchId, id }
    → GetCustomerHandler.execute(query)
      1. workContext.authorize()
      2. assertCustomerRead(role)
      3. customers.findByIdAndCompany(id, { organizationId, operatingCompanyId })
         → null → 404
      → CustomerResponse (200)
```

### 3.4 Flujo: Actualizar cliente

```
Frontend → PATCH /customers/:id (con campos parciales)
  → CustomersController.update()
    → UpdateCustomerCommand { firebaseUid, companyId, branchId, id, ...camposOpcionales }
    → UpdateCustomerHandler.execute(command)
      1. Valida countryEntryDate vs nationality si se envían (BR-CLI-002)
      2. workContext.authorize()
      3. assertCustomerWrite(role)
      4. customers.findByIdAndCompany() → null → 404
      5. customers.update(id, data)
      → CustomerResponse (200)
```

---

## 4. Interacción con otros módulos

| Módulo | Tipo de relación | Descripción |
| --- | --- | --- |
| reservations | Referencia | El módulo de reservas puede referenciar un `customerId` al crear una reserva. No llama directamente al repositorio de clientes; usa el ID. |
| rentals | Referencia | El módulo de alquileres puede referenciar un `customerId`. |
| users | Dependencia | Usa `WorkContextAuthorizationService` para resolver `organizationId`, `operatingCompanyId` y `role`. |
| admin | Ninguna directa | Los permisos de clientes no se configuran desde el módulo Admin en el MVP. |

---

## 5. Consideraciones de diseño

### 5.1 Aislamiento multiempresa

El aislamiento es la característica más crítica del módulo. Se implementa en dos capas:

1. **Capa de aplicación**: `WorkContextAuthorizationService.authorize()` resuelve el `operatingCompanyId` del usuario autenticado. Los handlers nunca confían en el `operatingCompanyId` enviado por el cliente.
2. **Capa de repositorio**: todas las queries incluyen `operatingCompanyId = ?` en la cláusula WHERE.

### 5.2 Coincidencia de DNI

Cuando el frontend detecta un `409 CUSTOMER_DOCUMENT_ALREADY_EXISTS` en el submit del formulario de nuevo cliente, debe:
1. Mostrar un panel de coincidencia con los datos del cliente existente (obtenidos del body del 409 o haciendo un `GET /customers?search=documentNumber`).
2. Ofrecer las opciones "Usar cliente existente" y "Cancelar".

Este flujo está documentado en BDD SC-CLI-002 y en el prototipo PROTO-CLI-01-COINCIDENCIA-DNI.

### 5.3 Sin paginación cursor

El módulo usa paginación por offset (`page`, `limit`) en línea con el patrón estándar del proyecto. No hay cursor pagination en v0.1.0.
