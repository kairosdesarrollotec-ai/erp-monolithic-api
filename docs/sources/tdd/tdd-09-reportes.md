# TDD — 09 Reportes

# Technical Design Document — Reportes

**Código:** TDD-KAIROS-MVP-REP-001 **Versión:** 1.0 (creado 11-oct-2026 — base usable inicial) **Estado:** DRAFT **Entradas:** `BDD-REP-001`, `SDD-REP-001` **Dominio:** Reporting **Fecha:** 11 de octubre de 2026

> Depende de `TDD-KAIROS-TRANSVERSAL.md` para stack técnico, estructura de repositorio, convenciones de dominio, seguridad técnica, infraestructura, CI/CD, DoD y criterios de aprobación.

---

## 1. Control y autoridad

Ver `TDD-KAIROS-TRANSVERSAL.md`, secciones 1.2-1.3.

### 1.1 Documentos relacionados

| Documento | Relación |
| --- | --- |
| `BDD-REP-001` | Fuente funcional autoritativa |
| `SDD-REP-001` | Fuente arquitectónica |
| `TDD-KAIROS-TRANSVERSAL.md` | Base técnica común |

---

## 2. Objetivo técnico y alcance

Implementar el módulo NestJS `reporting` como un conjunto de queries de lectura sobre los modelos existentes. Sin entidades propias ni migraciones. Con aislamiento multiempresa y control de permisos `REPORT.*`.

### 2.1 Incluido

- Módulo NestJS `reporting` con solo queries (sin commands).
- Endpoints REST bajo `/reporting`.
- KPIs operativos y financieros.
- Exportación CSV de garantías.

### 2.2 Fuera de alcance

- Tablas nuevas — todas las fuentes ya existen.
- Caché de reportes — OQ-REP-003, pendiente de decisión de rendimiento.
- Contrato OpenAPI formal — definir antes de implementar frontend.

---

## 3. Fuentes de datos (tablas existentes)

| KPI | Tabla(s) | Filtro obligatorio |
| --- | --- | --- |
| Alquileres activos | `rentals` | `companyId` + `status='ACTIVO'` |
| Devoluciones pendientes | `returns` | `companyId` + `status NOT IN (CERRADA, CANCELADA)` |
| Flota disponible | `vehicles` LEFT JOIN `vehicle_commitments` | `companyId` + sin compromiso activo |
| Reservas activas | `reservations` | `companyId` + `status='CONFIRMED'` |
| Incidencias abiertas | `incidents` | `companyId` + `status != CLOSED` |
| Garantías retenidas | `rental_deposits` | `companyId via rentals` + `status IN (HELD, PARTIALLY_RETAINED)` |
| Garantías liberadas | `rental_deposit_adjustments` | `companyId via rentals` + `type='RELEASE'` + rango de fechas |

---

## 4. Arquitectura del módulo

```
modules/reporting/
  domain/
    ports/
      reporting.repository.ts         # Puerto abstracto — solo queries
  application/
    queries/
      get-operational-kpis.query.ts
      get-financial-kpis.query.ts
      get-activity.query.ts
      export-deposits.query.ts
  infrastructure/
    prisma-reporting.repository.ts     # Implementa el puerto con Prisma
  presentation/
    reporting.controller.ts
    dto/
      operational-kpis.dto.ts
      financial-kpis.dto.ts
      export-deposits-query.dto.ts     # Incluye validación de rango <= 90 días
  reporting.module.ts
```

---

## 5. Requisitos trazados

| BDD | SDD | Realización TDD |
| --- | --- | --- |
| BR-REP-001 / DAT-REP-001 | UC-REP-001 | `GetOperationalKpisQueryHandler` |
| BR-REP-002 / DAT-REP-002/003 | UC-REP-002 | `GetFinancialKpisQueryHandler` |
| BR-REP-003/005 | UC-REP-003 | `ExportDepositsQueryHandler` |

---

## 6. Validaciones y reglas técnicas

| Regla | Implementación |
| --- | --- |
| BR-REP-004: aislamiento multiempresa | Todas las queries incluyen JOIN/WHERE por `companyId` del actor |
| BR-REP-005: máximo 90 días en exportación | `ExportDepositsQueryDto` valida con `@IsDateRange({ max: 90 })` |
| BR-REP-007: solo PLATFORM_ADMIN/CORPORATE_AUDITOR pueden override de companyId | Guard de permisos + validación de rol en el handler |

---

## 7. Seguridad técnica

- `@UseGuards(FirebaseAuthGuard, PermissionsGuard)` en todos los endpoints.
- `PermissionsGuard` valida `REPORT.*` según decorador `@RequirePermission`.
- Las queries no exponen PII individual en KPIs (solo agregados).
- La exportación CSV excluye datos biométricos y documentos completos.

---

## 8. Pruebas requeridas

| Tipo | Descripción | Obligatorio |
| --- | --- | --- |
| Unitario | Validación de rango de fechas > 90 días rechazado | Sí |
| Integración | Queries contra DB de prueba con datos de múltiples empresas | Sí |
| Aislamiento | Actor empresa A no ve KPIs de empresa B (P0) | Sí |
| Contrato | DTOs vs esquema OpenAPI (cuando el contrato esté definido) | Cuando exista contrato |
