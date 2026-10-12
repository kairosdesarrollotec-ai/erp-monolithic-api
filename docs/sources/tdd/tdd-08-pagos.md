# TDD — 08 Pagos y Garantías

# Technical Design Document — Pagos y Garantías

**Código:** TDD-KAIROS-MVP-PAG-001 **Versión:** 1.0 (creado 11-oct-2026 — base usable inicial) **Estado:** DRAFT **Entradas:** `BDD-PAG-001`, `SDD-PAG-001` **Dominio:** Payments **Fecha:** 11 de octubre de 2026

> Depende de `TDD-KAIROS-TRANSVERSAL.md` para stack técnico, estructura de repositorio, convenciones de dominio, seguridad técnica, infraestructura, CI/CD, DoD y criterios de aprobación.

---

## 1. Control y autoridad

Ver `TDD-KAIROS-TRANSVERSAL.md`, secciones 1.2-1.3.

### 1.1 Documentos relacionados

| Documento | Relación |
| --- | --- |
| `BDD-PAG-001` | Fuente funcional autoritativa |
| `SDD-PAG-001` | Fuente arquitectónica |
| `TDD-KAIROS-TRANSVERSAL.md` | Base técnica común |
| `TDD-ALQ-001` | Módulo que crea las tablas de garantía |
| `TDD-DEV-001` | Módulo que resuelve la garantía en devolución |

---

## 2. Objetivo técnico y alcance

Implementar el módulo NestJS `payments` que expone consulta, ajuste y resolución de garantías sobre las tablas existentes `rental_deposits` y `rental_deposit_adjustments`, con aislamiento multiempresa y control de permisos `PAYMENT.*`.

### 2.1 Incluido

- Módulo NestJS `payments` con commands y queries.
- Endpoints REST bajo `/payments`.
- Integración con módulo `admin` para validación de permisos.
- Pruebas unitarias de dominio y pruebas de aislamiento multiempresa.

### 2.2 Fuera de alcance

- Migraciones nuevas — las tablas ya existen.
- Integración con pasarelas de pago externas.
- Contrato OpenAPI formal — definir antes de implementar frontend.

---

## 3. Modelo de datos (existente — sin migraciones nuevas)

```
rental_deposits
  id             UUID PK
  rental_id      UUID UNIQUE FK → rentals.id
  original_amount DECIMAL(12,2)
  currency       CHAR(3)
  status         VARCHAR  -- HELD | RETURNED | RETAINED | PARTIALLY_RETAINED
  created_at     TIMESTAMPTZ

rental_deposit_adjustments
  id             UUID PK
  deposit_id     UUID FK → rental_deposits.id
  type           VARCHAR  -- DISCOUNT | FULL_RETENTION | RELEASE | IMMOBILIZATION_CHARGE
  amount         DECIMAL(12,2)
  reason         VARCHAR(500)
  authorized_by  VARCHAR  -- userId
  created_at     TIMESTAMPTZ
```

**Nota:** El estado calculado de la garantía (`PARTIALLY_RETAINED` vs `RETURNED`) se deriva de los ajustes acumulados. El campo `status` en `rental_deposits` se actualiza de forma consistente en la misma transacción que registra el ajuste.

---

## 4. Arquitectura del módulo

```
modules/payments/
  domain/
    rental-deposit.aggregate.ts        # Agregado read-only + comandos de ajuste
    rental-deposit-adjustment.entity.ts
    deposit-status.enum.ts
    adjustment-type.enum.ts
    ports/
      rental-deposit.repository.ts    # Puerto abstracto
  application/
    commands/
      register-adjustment.command.ts
      approve-refund.command.ts
      close-financial.command.ts
    queries/
      list-deposits.query.ts
      get-deposit-detail.query.ts
  infrastructure/
    prisma-rental-deposit.repository.ts
  presentation/
    payments.controller.ts
    dto/
      register-adjustment.dto.ts
      approve-refund.dto.ts
  payments.module.ts
```

---

## 5. Requisitos trazados

| BDD | SDD | Realización TDD |
| --- | --- | --- |
| PAG-P02 / BR-PAG-007 | UC-PAG-001 | `ListDepositsQueryHandler` |
| PAG-P02 / BR-PAG-009 | UC-PAG-002 | `GetDepositDetailQueryHandler` |
| PAG-P03 / BR-PAG-003 | UC-PAG-003 | `RegisterAdjustmentHandler` |
| PAG-P04 / BR-PAG-004/005 | UC-PAG-004 | `ApproveRefundHandler` |
| PAG-P05 | UC-PAG-005 | `CloseFinancialHandler` |

---

## 6. Invariantes de dominio

| Invariante | Regla | Handler |
| --- | --- | --- |
| INV-PAG-001 | Solo una garantía activa por alquiler | `RentalDeposit.create()` valida `@unique rental_id` |
| INV-PAG-002 | Ajustes son append-only | No existe `update` ni `delete` en `IRentalDepositRepository` |
| INV-PAG-003 | El monto del ajuste no puede superar el saldo disponible | `RegisterAdjustmentHandler` valida antes de insertar |
| INV-PAG-004 | `CLOSE_FINANCIAL` solo cuando no hay ajustes pendientes | `CloseFinancialHandler` verifica estado final |
| INV-PAG-005 | El actor no puede operar sobre garantías de otra empresa | Todo handler verifica `rental.companyId == actor.companyId` |

---

## 7. Seguridad técnica

- `@UseGuards(FirebaseAuthGuard, PermissionsGuard)` en todos los endpoints.
- `PermissionsGuard` valida `PAYMENT.*` según el decorador `@RequirePermission`.
- Las queries Prisma incluyen siempre `WHERE rental.companyId = :companyId` para garantizar aislamiento.
- Los comandos usan `idempotency_keys` para prevenir doble registro de ajustes.
- No se registra `reason` ni `amount` en logs de nivel INFO.

---

## 8. Pruebas requeridas

| Tipo | Descripción | Obligatorio |
| --- | --- | --- |
| Unitario | Invariantes de dominio (INV-PAG-001..005) | Sí |
| Integración | `RegisterAdjustmentHandler` contra DB de prueba | Sí |
| Aislamiento | Actor empresa A no accede a garantías empresa B (P0) | Sí |
| Contrato | DTOs vs esquema OpenAPI (cuando el contrato esté definido) | Cuando exista contrato |
| Concurrencia | Doble registro de ajuste con misma idempotency key | Sí |
