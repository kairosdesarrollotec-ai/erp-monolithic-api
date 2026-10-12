# BDD — 09 Pagos y Garantías

# BDD-PAG-001 — Proceso: Pagos y Garantías

**Código:** BDD-KAIROS-MVP-PAG-001 **Versión:** 1.0 (creado 11-oct-2026 — base usable inicial a partir de SDD-03/04 y esquema Prisma existente) **Depende de:** `BDD-KAIROS-TRANSVERSAL.md` (glosario, actores, catálogo de Cliente, reglas transversales, NFR, privacidad, criterios de aceptación)

> Este documento consolida las reglas financieras de garantía que ya existen dispersas en BDD-ALQ-001 y BDD-DEV-001, y las eleva a un módulo observable independiente — Pagos — que permite consultar, ajustar y resolver la garantía sin tener que abrir el flujo de Alquiler o Devolución.

---

## 1. Contexto y alcance

El módulo Pagos expone de forma centralizada:

- El historial de la garantía por alquiler (estado actual + ajustes registrados).
- Las acciones de resolución financiera: registrar ajuste, aprobar devolución, cerrar financiero.
- La trazabilidad del ciclo completo: desde el depósito inicial hasta la resolución final.

Este módulo **no reemplaza** el registro de garantía dentro de Alquiler (BR-ALQ-006) ni el cierre financiero dentro de Devolución (DEV-P06/P07/P09). Es una vista y un punto de acción independiente para los roles financieros y de operaciones.

---

## 2. Flujo del proceso

| Paso | Actor principal | Acción | Información gestionada | Regla/decisión | Resultado |
| --- | --- | --- | --- | --- | --- |
| PAG-P01 | Cajero / Administ. | Registrar garantía | Monto, moneda, método | Al formalizar contrato (dentro de Alquiler UC-ALQ-004) | Garantía en estado `HELD` |
| PAG-P02 | Aprobador Financiero | Consultar historial | Estado de garantía, ajustes | Cualquier rol con `PAYMENT.READ_LIST` | Lista de garantías del período |
| PAG-P03 | Cajero | Registrar ajuste | Tipo, monto, razón | Requiere `PAYMENT.REGISTER_ADJUSTMENT`; tipos: `DISCOUNT`, `FULL_RETENTION`, `IMMOBILIZATION_CHARGE`, `RELEASE` | Ajuste registrado en la garantía |
| PAG-P04 | Aprobador Financiero | Aprobar devolución | Monto neto, acta (opcional) | Requiere `PAYMENT.APPROVE_REFUND`; solo cuando garantía en `HELD` o `PARTIALLY_RETAINED` y devolución sin daño grave (BR-DEV-001) | Garantía en estado `RETURNED` |
| PAG-P05 | Aprobador Financiero | Cerrar financiero | Estado final de garantía | Requiere `PAYMENT.CLOSE_FINANCIAL`; marca la devolución como `CIERRE_FINANCIERO` completado | Expediente financiero cerrado |

---

## 3. Datos gestionados

| ID | Información | Obligatoria | Condición | Validación funcional | Finalidad | Sensibilidad |
| --- | --- | --- | --- | --- | --- | --- |
| DAT-PAG-001 | Monto original de la garantía | Sí | Siempre | Decimal positivo, moneda ISO 4217 | Base financiera del expediente | Financiera |
| DAT-PAG-002 | Estado de la garantía | Sí | Siempre | `HELD` / `RETURNED` / `RETAINED` / `PARTIALLY_RETAINED` | Refleja el ciclo de vida del depósito | Financiera |
| DAT-PAG-003 | Tipo de ajuste | Sí | Con ajuste | `DISCOUNT` / `FULL_RETENTION` / `RELEASE` / `IMMOBILIZATION_CHARGE` | Clasifica el movimiento | Financiera |
| DAT-PAG-004 | Monto del ajuste | Sí | Con ajuste | Decimal positivo | Cálculo del saldo neto | Financiera |
| DAT-PAG-005 | Razón del ajuste | Sí | Con ajuste | Texto libre, máx. 500 caracteres | Trazabilidad y auditoría | Interna |
| DAT-PAG-006 | Autorizado por | Sí | Con ajuste | `userId` del actor que autoriza | No-repudio | Auditada |
| DAT-PAG-007 | Acta de devolución de garantía | Condicional | Si el cliente la solicita (BR-DEV-010) | Documento generado desde plantilla | Respaldo al cliente | Normal |

---

## 4. Reglas de negocio

| ID | Regla | Prioridad | Fuente | Estado |
| --- | --- | --- | --- | --- |
| BR-PAG-001 | Una garantía se crea en estado `HELD` al formalizar el contrato de alquiler | Crítica | BDD-ALQ-001 BR-ALQ-006 | `CONFIRMADO` |
| BR-PAG-002 | Solo puede existir **una** garantía activa por alquiler (relación 1-1 `rental_deposits`) | Crítica | Esquema Prisma `@unique rental_id` | `CONFIRMADO` |
| BR-PAG-003 | Los ajustes son **append-only** — ningún ajuste puede modificarse ni eliminarse | Alta | TDD-03 §9.4 | `CONFIRMADO` |
| BR-PAG-004 | Una devolución sin daños libera la garantía en un máximo de 24 horas naturales (BR-DEV-001 replicada) | Crítica | BDD-DEV-001 BR-DEV-001 | `CONFIRMADO` |
| BR-PAG-005 | Un daño grave suspende el plazo de 24h; la garantía queda `RETAINED` hasta resolución gerencial | Crítica | BDD-DEV-001 BR-DEV-002 | `CONFIRMADO` |
| BR-PAG-006 | Si el vehículo queda paralizado más de 24h, los días de paralización se cobran como alquiler adicional mediante un ajuste de tipo `IMMOBILIZATION_CHARGE` (BR-DEV-011 replicada) | Alta | BDD-DEV-001 BR-DEV-011 | `CONFIRMADO` |
| BR-PAG-007 | Solo roles con `PAYMENT.REGISTER_ADJUSTMENT` pueden registrar ajustes; solo roles con `PAYMENT.APPROVE_REFUND` pueden aprobar devoluciones | Alta | ADM-02 (matriz de permisos) | `CONFIRMADO` |
| BR-PAG-008 | El acta de devolución de garantía se emite solo si el cliente la solicita (BR-DEV-010 replicada) | Baja | BDD-DEV-001 BR-DEV-010 | `CONFIRMADO` |
| BR-PAG-009 | El módulo Pagos opera bajo el mismo aislamiento multiempresa que los demás módulos: toda consulta filtra por `companyId` y `branchId` del actor | Crítica | SDD-KAIROS-TRANSVERSAL.md §multiempresa | `CONFIRMADO` |

---

## 5. Escenarios Gherkin

```gherkin
Feature: Consulta de garantía activa
  Scenario: Cajero consulta garantía de un alquiler activo
    Given el cajero tiene permiso PAYMENT.READ_DETAIL
    And existe un alquiler activo "ALQ-001" con garantía de S/ 500
    When el cajero accede al detalle del alquiler en el módulo Pagos
    Then ve el monto original S/ 500 y el estado HELD
    And ve la lista de ajustes vacía

Feature: Registro de ajuste de garantía
  Scenario: Cajero registra descuento por daño estético
    Given el cajero tiene permiso PAYMENT.REGISTER_ADJUSTMENT
    And la garantía del alquiler está en estado HELD
    When el cajero registra un ajuste DISCOUNT de S/ 180 con razón "Paño puerta derecha"
    Then el ajuste queda registrado con el userId del cajero
    And el saldo calculado de la garantía refleja S/ 500 - S/ 180 = S/ 320

Feature: Aprobación de devolución de garantía
  Scenario: Aprobador financiero libera garantía sin daños dentro de 24h
    Given el aprobador tiene permiso PAYMENT.APPROVE_REFUND
    And la devolución está cerrada sin daños
    And han pasado menos de 24 horas naturales desde el cierre
    When el aprobador aprueba la devolución de garantía
    Then la garantía cambia a estado RETURNED
    And se registra un ajuste de tipo RELEASE por el monto total

Feature: Aislamiento multiempresa
  Scenario: Cajero de empresa A no puede ver garantías de empresa B
    Given el cajero pertenece a empresa A
    And existe una garantía activa en empresa B
    When el cajero consulta el listado de garantías
    Then no ve ninguna garantía de empresa B
    And el sistema no devuelve error, solo filtra silenciosamente
```

---

## 6. Preguntas abiertas

| ID | Pregunta | Estado |
| --- | --- | --- |
| OQ-PAG-001 | ¿Se registra el pago del alquiler (monto diario × días) como un registro financiero explícito, o solo se calcula desde el contrato? | `ABIERTA` — sin impacto en MVP; el monto surge del contrato |
| OQ-PAG-002 | ¿Existe un flujo de pago parcial de garantía (p.ej., el cliente paga solo una parte del daño de inmediato)? | `ABIERTA` — no documentado en BDD-ALQ ni BDD-DEV; no implementar hasta decisión |
| OQ-PAG-003 | ¿Las ampliaciones de alquiler generan un nuevo pago registrable independiente, o se agregan al contrato original? | `ABIERTA` — RentalExtension.paymentId existe en el esquema pero sin BDD que lo defina |
