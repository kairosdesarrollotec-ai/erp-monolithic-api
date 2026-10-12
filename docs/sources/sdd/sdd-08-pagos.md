# SDD — 08 Pagos y Garantías

# Solution Design Document — Pagos y Garantías

**Código:** SDD-KAIROS-MVP-PAG-001 **Versión:** 1.0 (creado 11-oct-2026 — base usable inicial) **Estado:** DRAFT — base usable, pendiente de revisión formal **Entrada funcional:** `BDD-PAG-001` v1.0 **Depende de:** `SDD-KAIROS-TRANSVERSAL.md` **Alcance:** Consulta, ajuste y resolución financiera de garantías de alquiler **Fecha:** 11 de octubre de 2026

> Este documento traduce BDD-PAG-001 a una solución lógica verificable. Para todo lo que no varía por proceso (multiempresa, seguridad, stack, despliegue), ver `SDD-KAIROS-TRANSVERSAL.md`.

---

## 1. Control y gobernanza

### 1.1 Historial

| Versión | Cambio | Estado |
| --- | --- | --- |
| 1.0 | Creación inicial — base usable a partir de BDD-PAG-001 y esquema Prisma existente | DRAFT |

### 1.2 Documentos relacionados

| Documento | Relación |
| --- | --- |
| `BDD-PAG-001` v1.0 | Fuente funcional autoritativa |
| `SDD-KAIROS-TRANSVERSAL.md` | Arquitectura base común |
| `SDD-ALQ-001` | Registra la garantía inicial (UC-ALQ-004) |
| `SDD-DEV-001` | Resuelve la garantía al cerrar la devolución |
| `TDD-PAG-001` | Refinamiento técnico (este SDD) |

---

## 2. Resumen ejecutivo

El módulo Pagos expone la garantía de alquiler — existente en las tablas `rental_deposits` y `rental_deposit_adjustments` — como un módulo observable independiente con acceso controlado por permisos. No duplica la lógica de registro (que vive en Alquiler) ni la de resolución de daños (que vive en Devolución), pero provee los endpoints de consulta y las acciones financieras (`REGISTER_ADJUSTMENT`, `APPROVE_REFUND`, `CLOSE_FINANCIAL`) que operaciones y finanzas necesitan sin tener que navegar el flujo completo.

---

## 3. Alcance

### 3.1 Incluido

- Consulta paginada de garantías por empresa/sede/período (`READ_LIST`).
- Detalle de una garantía con historial de ajustes (`READ_DETAIL`).
- Registro de ajuste de garantía — append-only (`REGISTER_ADJUSTMENT`).
- Aprobación de devolución de garantía (`APPROVE_REFUND`).
- Cierre financiero del expediente (`CLOSE_FINANCIAL`).

### 3.2 Excluido

- Registro inicial de la garantía — lo hace Alquiler (UC-ALQ-004).
- Registro de daños — lo hace Devolución.
- Integración con pasarelas de pago externas — fuera del MVP.
- Flujo de pago parcial de garantía — OQ-PAG-002, sin BDD que lo defina.

### 3.3 Dependencias

| Dependencia | Requerida para | Dueño |
| --- | --- | --- |
| Rentals | Datos del alquiler y cliente de origen | Alquiler |
| Returns | Estado de la devolución para habilitar el cierre financiero | Devolución |
| Admin (permisos) | Validación de PAYMENT.* acciones | Admin |

---

## 4. Casos de uso

### UC-PAG-001 — Listar garantías

**Actor:** Cajero / Aprobador Financiero / Ops Manager  
**Permiso:** `PAYMENT.READ_LIST`  
**Trigger:** El actor abre el módulo Pagos  
**Pasos:**
1. El sistema filtra `rental_deposits` por `companyId` + `branchId` del actor.
2. Retorna lista paginada con: `rentalId`, `status`, `originalAmount`, `currency`, `createdAt`.
3. Permite filtro por `status` y rango de fechas `createdAt`.

**Postcondición:** Lista visible, sin datos de otras empresas.

---

### UC-PAG-002 — Ver detalle de garantía

**Actor:** Cajero / Aprobador Financiero  
**Permiso:** `PAYMENT.READ_DETAIL`  
**Trigger:** El actor selecciona una garantía de la lista  
**Pasos:**
1. El sistema carga `rental_deposits` + `rental_deposit_adjustments` por `rentalId`.
2. Verifica que `rental.companyId` == `actor.companyId` (ownership).
3. Retorna: monto original, estado actual, lista de ajustes con tipo/monto/razón/autorizado.

**Postcondición:** Detalle visible con historial de ajustes completo.

---

### UC-PAG-003 — Registrar ajuste de garantía

**Actor:** Cajero  
**Permiso:** `PAYMENT.REGISTER_ADJUSTMENT`  
**Trigger:** Actor crea un ajuste sobre una garantía en estado `HELD` o `PARTIALLY_RETAINED`  
**Pasos:**
1. Validar ownership (garantía pertenece a la empresa del actor).
2. Validar que el tipo de ajuste es uno de: `DISCOUNT`, `FULL_RETENTION`, `RELEASE`, `IMMOBILIZATION_CHARGE`.
3. Validar que el monto es positivo y no supera el saldo disponible.
4. Insertar registro en `rental_deposit_adjustments` con `authorizedBy = actor.userId`.
5. Recalcular el estado de la garantía según los ajustes acumulados.

**Postcondición:** Ajuste registrado, estado actualizado.

---

### UC-PAG-004 — Aprobar devolución de garantía

**Actor:** Aprobador Financiero  
**Permiso:** `PAYMENT.APPROVE_REFUND`  
**Pre:** Devolución cerrada sin daño grave; garantía en `HELD` o `PARTIALLY_RETAINED`.  
**Pasos:**
1. Verificar que la devolución asociada no tiene daño `GRAVE` activo.
2. Registrar ajuste de tipo `RELEASE` por el saldo neto restante.
3. Cambiar el estado de la garantía a `RETURNED`.
4. Si el cliente solicitó el acta (BR-PAG-008): generar desde plantilla.

**Postcondición:** Garantía en `RETURNED`. Acta disponible si fue solicitada.

---

### UC-PAG-005 — Cerrar financiero

**Actor:** Aprobador Financiero  
**Permiso:** `PAYMENT.CLOSE_FINANCIAL`  
**Pre:** Garantía en estado terminal (`RETURNED`, `RETAINED`, o `PARTIALLY_RETAINED` resuelto).  
**Pasos:**
1. Verificar que no hay ajustes pendientes de autorización.
2. Actualizar la devolución asociada a estado `CIERRE_FINANCIERO`.
3. Registrar evento de dominio `PaymentFinanciallyClosed`.

**Postcondición:** Expediente financiero cerrado. No se permiten más ajustes.

---

## 5. Módulo NestJS propuesto

- **Módulo:** `payments` (nuevo, dentro de `apps/api/src/modules/`)
- **Dominio:** `RentalDeposit` agregado (read-only projection + comandos de ajuste)
- **Puertos:** `IRentalDepositRepository`, `IRentalRepository` (para validar ownership)
- **Adaptadores:** Prisma — usa tablas existentes `rental_deposits`, `rental_deposit_adjustments`
- **Presentación:** `PaymentsController` con endpoints bajo `/payments`

> Las tablas `rental_deposits` y `rental_deposit_adjustments` ya existen — no se requieren migraciones nuevas para el MVP. El módulo accede a estas tablas como **propietario de lectura y comandos de ajuste**, mientras que Alquiler retiene la responsabilidad de la creación inicial de la garantía.

---

## 6. OpenAPI (esquema de endpoints necesarios)

| Método | Ruta | Permiso | Descripción |
| --- | --- | --- | --- |
| `GET` | `/payments/deposits` | `PAYMENT.READ_LIST` | Lista paginada de garantías |
| `GET` | `/payments/deposits/:rentalId` | `PAYMENT.READ_DETAIL` | Detalle de garantía + ajustes |
| `POST` | `/payments/deposits/:rentalId/adjustments` | `PAYMENT.REGISTER_ADJUSTMENT` | Registrar ajuste |
| `POST` | `/payments/deposits/:rentalId/refund` | `PAYMENT.APPROVE_REFUND` | Aprobar devolución |
| `POST` | `/payments/deposits/:rentalId/close-financial` | `PAYMENT.CLOSE_FINANCIAL` | Cerrar financiero |

> STOP `MISSING_API_CONTRACT`: el contrato OpenAPI formal en `packages/contracts/openapi/` **no existe aún**. Estos endpoints son la propuesta a formalizar. No implementar frontend hasta que el contrato esté definido y registrado.

---

## 7. Seguridad y multiempresa

- Todo endpoint valida el `companyId` y `branchId` del actor contra los datos de la garantía.
- El backend rechaza con `403` cualquier intento de acceder a garantías de otra empresa.
- No se registran montos ni razones de ajuste en logs de nivel INFO o superior.
- Los endpoints de escritura requieren idempotency key para prevenir doble registro.
