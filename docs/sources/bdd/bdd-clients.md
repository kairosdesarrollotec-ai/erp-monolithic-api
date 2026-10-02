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
  - packages/contracts/openapi/customers.yaml v0.1.0
  - apps/api/src/modules/customers/domain/customer.ts
  - apps/api/src/modules/customers/application/policies/customer-role.policy.ts
  - artifacts/traceability/customers/ (pendiente de creación)
---

## 0. Control de cambios

| Versión | Fecha | Autor | Cambio |
| --- | --- | --- | --- |
| 1.0 | 2026-10-01 | Russbel Hernández | Documento inicial — consolida comportamiento observable del módulo Customers implementado. Fuente primaria: customers.yaml v0.1.0 y modelo de dominio Customer. |

---

## 1. Alcance del módulo

### 1.1 Incluido

- Registro de clientes de alquiler de una empresa del Grupo KAIROS.
- Detección de coincidencia de documento (tipo + número) al intentar registrar un cliente duplicado.
- Consulta de la ficha completa (360°) de un cliente existente.
- Actualización de datos de un cliente existente.
- Listado filtrado de clientes por empresa y sede, con búsqueda por nombre o número de documento.
- Validación de `countryEntryDate` exclusiva para clientes de nacionalidad EXTRANJERO.

### 1.2 Excluido

- Historial de reservas o alquileres del cliente — responsabilidad del módulo `reservations` / `rentals`.
- Blacklist o scoring de riesgo de clientes — fuera del MVP.
- Documentos adjuntos (licencias de conducir, pasaporte) — fuera del MVP.
- Importación masiva de clientes.

### 1.3 Dependencias

- `reservations` — puede referenciar `customerId` al crear una reserva.
- `rentals` — puede referenciar `customerId` en el contrato de alquiler.
- Firebase Authentication — autentica y autoriza todas las operaciones.

---

## 2. Actores y sistemas

| Actor / Sistema | Tipo | Operaciones permitidas |
| --- | --- | --- |
| Front Office (FRONT_OFFICE) | Persona — rol estándar | Crear, actualizar, listar, ver ficha — solo en su empresa |
| Administración (ADMINISTRACION) | Persona — rol estándar | Crear, actualizar, listar, ver ficha — solo en su empresa |
| Gerencia (GERENCIA) | Persona — rol privilegiado | Crear, actualizar, listar, ver ficha — solo en su empresa |
| Campo (CAMPO) | Persona — rol de operaciones | Solo lectura (listar y ver ficha) |
| Finanzas (FINANZAS) | Persona — rol financiero | Solo lectura (listar y ver ficha) |
| Auditoría (AUDITORIA) | Persona — rol de control | Solo lectura (listar y ver ficha) |
| Platform Administrator (PLATFORM_ADMIN) | Persona — rol privilegiado | Todas las operaciones de cualquier empresa |
| Sistema (reservations, rentals) | Sistema interno | Referencia a `customerId` — no gestiona la ficha directamente |

---

## 3. Catálogo de datos

### DAT-CLI-001: Cliente

| Campo | Tipo | Obligatorio | Descripción |
| --- | --- | --- | --- |
| id | UUID | Sí (generado) | Identificador único del cliente |
| organizationId | UUID | Sí | Organización del tenant |
| operatingCompanyId | UUID | Sí | Empresa a la que pertenece el cliente |
| fullName | string | Sí | Nombre completo del cliente |
| documentType | string | Sí | Tipo de documento (ej. DNI, PASAPORTE, CE) |
| documentNumber | string | Sí | Número de documento |
| nationality | enum | No | PERUANO, EXTRANJERO o null |
| countryEntryDate | date | No | Fecha de ingreso al país — solo válida para EXTRANJERO |
| email | string | No | Correo electrónico del cliente |
| phone | string | No | Teléfono de contacto |
| address | string | No | Dirección del cliente |
| createdAt | datetime | Sí (generado) | Fecha de registro |
| updatedAt | datetime | Sí (generado) | Fecha de última actualización |

**Nota:** El par `(documentType, documentNumber)` es único por empresa (`operatingCompanyId`). El mismo documento puede existir en empresas distintas del Grupo.

---

## 4. Reglas de negocio

### BR-CLI-001 — Unicidad de documento por empresa

La combinación `documentType + documentNumber` debe ser única dentro de una misma `operatingCompanyId`.

- Si se intenta registrar un cliente con un documento que ya existe en la misma empresa: `409 CUSTOMER_DOCUMENT_ALREADY_EXISTS`.
- La regla aplica tanto en la creación (POST) como se verifica antes de ejecutar la inserción.
- Esta restricción existe a nivel de base de datos (unique constraint en Prisma) y también se valida en la capa de aplicación.

### BR-CLI-002 — Fecha de ingreso al país solo para extranjeros

`countryEntryDate` es un campo válido únicamente cuando `nationality` es `EXTRANJERO`.

- Si se envía `countryEntryDate` con `nationality !== 'EXTRANJERO'`: la operación falla con `400 COUNTRY_ENTRY_DATE_ONLY_FOR_FOREIGNERS`.
- Si `nationality` es `PERUANO` o `null`, el campo `countryEntryDate` debe omitirse o enviarse como `null`.

### BR-CLI-003 — Aislamiento por empresa

Un cliente pertenece a una única empresa (`operatingCompanyId`).

- El backend siempre filtra los clientes por la empresa del contexto de trabajo del usuario autenticado.
- No es posible que un usuario de la empresa A vea, modifique o liste clientes de la empresa B.
- `organizationId` se hereda del contexto de autenticación, no se puede sobreescribir desde el frontend.

### BR-CLI-004 — Normalización de documentos

El backend normaliza `documentType` y `documentNumber` al crear un cliente:

- `documentType` se convierte a mayúsculas y se elimina el espacio al inicio/fin.
- `documentNumber` se elimina el espacio al inicio/fin.
- Esta normalización ocurre antes de la verificación de duplicados.

### BR-CLI-005 — Actualización parcial

`PATCH /customers/{id}` acepta cualquier subconjunto de campos actualizables. Solo se modifican los campos enviados en el body.

- Si se envía `countryEntryDate` con un `nationality` existente `!= EXTRANJERO`, aplica BR-CLI-002.
- No se puede cambiar `documentType` ni `documentNumber` por este endpoint (no están en el contrato PATCH).

---

## 5. Escenarios

### SC-CLI-001 — Registrar un cliente nuevo

**Dado** un usuario con rol FRONT_OFFICE o ADMINISTRACION autenticado en una empresa.
**Cuando** envía `POST /customers` con `fullName`, `documentType` y `documentNumber`.
**Entonces** el sistema:

1. Verifica que no exista un cliente con el mismo `documentType + documentNumber` en esa empresa.
2. Normaliza `documentType` (uppercase, trim) y `documentNumber` (trim).
3. Crea el registro con `organizationId` y `operatingCompanyId` del contexto de trabajo.
4. Devuelve `201 Created` con el `CustomerResponse` completo.

**Resultado alternativo A — Documento ya existe:**
Si el documento ya está registrado en esa empresa: `409 CUSTOMER_DOCUMENT_ALREADY_EXISTS`. No se crea el registro.

**Resultado alternativo B — countryEntryDate inválido:**
Si se envía `countryEntryDate` con `nationality !== 'EXTRANJERO'`: `400 COUNTRY_ENTRY_DATE_ONLY_FOR_FOREIGNERS`.

**Resultado alternativo C — Sin permisos de escritura:**
Si el rol del usuario no está en WRITE_ROLES (GERENCIA, ADMINISTRACION, FRONT_OFFICE, PLATFORM_ADMIN): `403 Forbidden`.

---

### SC-CLI-002 — Coincidencia de documento al registrar

**Dado** que ya existe un cliente `C1` con `documentType=DNI` y `documentNumber=12345678` en la empresa A.
**Cuando** un usuario intenta registrar un nuevo cliente con el mismo `documentType=DNI` y `documentNumber=12345678` en la empresa A.
**Entonces** el sistema responde `409 CUSTOMER_DOCUMENT_ALREADY_EXISTS`.

**Comportamiento esperado en el frontend (CLI-01):**
El modal de registro detecta el 409, muestra un panel de "Coincidencia" con los datos del cliente existente, y ofrece dos opciones:
1. "Usar cliente existente" — navega a la ficha del cliente existente (CLI-02).
2. "Cancelar" — descarta el intento de registro.

---

### SC-CLI-003 — Listar clientes de la empresa

**Dado** un usuario autenticado en una empresa (cualquier rol de lectura).
**Cuando** llama `GET /customers` con su contexto de trabajo.
**Entonces** el sistema devuelve solo los clientes de la empresa del usuario (`operatingCompanyId`), paginados.

- Filtros disponibles: `search` (busca por nombre, tipo de documento y número de documento), `page`, `limit`.
- Nunca aparecen clientes de otras empresas en la respuesta.

---

### SC-CLI-004 — Consultar la ficha 360 de un cliente

**Dado** un usuario autenticado en una empresa con rol de lectura.
**Cuando** llama `GET /customers/{id}`.
**Entonces** el sistema verifica que el cliente pertenece a la empresa del usuario y devuelve el `CustomerResponse` completo.

**Resultado alternativo — Cliente de otra empresa:**
Si el `id` no pertenece a la empresa del usuario: `404 Not Found` (no expone la existencia del recurso en otra empresa).

**Resultado alternativo — Sin permisos de lectura:**
Si el rol no está en READ_ROLES: `403 Forbidden`.

---

### SC-CLI-005 — Actualizar datos de un cliente existente

**Dado** un usuario con rol de escritura autenticado en la misma empresa del cliente.
**Cuando** envía `PATCH /customers/{id}` con uno o más campos actualizables.
**Entonces** el sistema:

1. Verifica que el cliente pertenece a la empresa del usuario.
2. Aplica las validaciones de negocio (BR-CLI-002 si se envía `countryEntryDate`).
3. Actualiza solo los campos enviados.
4. Devuelve `200 OK` con el `CustomerResponse` actualizado.

**Resultado alternativo — Sin permisos de escritura:**
Si el rol no está en WRITE_ROLES: `403 Forbidden`.

---

## 6. Estados del cliente

El módulo Clientes no tiene un campo `status` explícito en el MVP. Un cliente es un registro activo mientras exista en la base de datos. La baja o inactivación de clientes está fuera del alcance del MVP.

---

## 7. Permisos por rol

| Operación | GERENCIA | ADMINISTRACION | FRONT_OFFICE | CAMPO | FINANZAS | AUDITORIA | PLATFORM_ADMIN |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Crear cliente | ✓ | ✓ | ✓ | — | — | — | ✓ |
| Actualizar cliente | ✓ | ✓ | ✓ | — | — | — | ✓ |
| Listar clientes | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Ver ficha 360 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

Fuente: `customer-role.policy.ts` — WRITE_ROLES y READ_ROLES.
