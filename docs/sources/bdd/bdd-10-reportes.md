# BDD — 10 Reportes

# BDD-REP-001 — Proceso: Reportes Operativos y Financieros

**Código:** BDD-KAIROS-MVP-REP-001 **Versión:** 1.0 (creado 11-oct-2026 — base usable inicial a partir de SDD-00 transversal, secciones de KPI y proyecciones de lectura) **Depende de:** `BDD-KAIROS-TRANSVERSAL.md` (glosario, actores, reglas transversales)

> Este documento define el comportamiento observable del módulo Reportes: qué KPIs son visibles, quién puede verlos, y bajo qué reglas se calculan. No define ni implementa un sistema de BI externo — los reportes son proyecciones de lectura sobre los datos existentes del ERP.

---

## 1. Contexto y alcance

El módulo Reportes provee:

- **Dashboard operativo**: KPIs en tiempo real del estado de operaciones (flota, alquileres, devoluciones, reservas).
- **Dashboard financiero**: KPIs del estado financiero (garantías, ingresos del período).
- **Exportación**: descarga de datos filtrados en formato CSV para análisis externo.

Los reportes son **vistas de lectura** — no modifican estado. Son proyecciones calculadas sobre los datos existentes, no una capa de BI separada.

---

## 2. KPIs operativos

| KPI | Descripción | Actualización | Fuente de datos |
| --- | --- | --- | --- |
| Alquileres activos | Cantidad de alquileres en curso (estado `ACTIVO`) | En tiempo real | `rentals` WHERE status='ACTIVO' |
| Devoluciones pendientes | Devoluciones programadas o en proceso (estado != `CERRADA`, != `CANCELADA`) | En tiempo real | `returns` WHERE status NOT IN (...) |
| Flota disponible | Vehículos sin compromiso activo | En tiempo real | `vehicles` LEFT JOIN `vehicle_commitments` |
| Reservas activas | Reservas confirmadas no convertidas | En tiempo real | `reservations` WHERE status='CONFIRMED' |
| Incidencias abiertas | Incidencias sin resolver | En tiempo real | `incidents` WHERE status != 'CLOSED' |

## 3. KPIs financieros

| KPI | Descripción | Actualización | Fuente de datos |
| --- | --- | --- | --- |
| Garantías retenidas | Suma de garantías en estado `HELD` o `PARTIALLY_RETAINED` | En tiempo real | `rental_deposits` WHERE status IN (...) |
| Garantías devueltas en el período | Suma de garantías liberadas en el rango de fechas | Por período | `rental_deposit_adjustments` WHERE type='RELEASE' |
| Garantías retenidas definitivamente | Suma de garantías en `RETAINED` | En tiempo real | `rental_deposits` WHERE status='RETAINED' |

---

## 4. Reglas de negocio

| ID | Regla | Prioridad | Fuente | Estado |
| --- | --- | --- | --- | --- |
| BR-REP-001 | Los reportes operativos solo son visibles para roles con `REPORT.READ_OPERATIONAL` | Alta | ADM-02 | `CONFIRMADO` |
| BR-REP-002 | Los reportes financieros solo son visibles para roles con `REPORT.READ_FINANCIAL` | Alta | ADM-02 | `CONFIRMADO` |
| BR-REP-003 | La exportación de datos requiere `REPORT.EXPORT` | Alta | ADM-02 | `CONFIRMADO` |
| BR-REP-004 | Todo reporte filtra por `companyId` y `branchId` del actor; un actor no puede ver datos de otra empresa | Crítica | SDD-KAIROS-TRANSVERSAL.md §multiempresa | `CONFIRMADO` |
| BR-REP-005 | El rango de fechas máximo para exportación es 90 días calendario | Media | Decisión de rendimiento — evitar queries costosas sin paginación | `CONFIRMADO` |
| BR-REP-006 | Los KPIs del dashboard se calculan sobre los datos de la empresa y sede del actor autenticado | Alta | SDD-KAIROS-TRANSVERSAL.md §multiempresa | `CONFIRMADO` |
| BR-REP-007 | No se expone información de otras empresas del Grupo KAIROS salvo que el actor tenga rol `CORPORATE_AUDITOR` o `PLATFORM_ADMIN` | Crítica | TDD-00 §8.4 / multiempresa | `CONFIRMADO` |

---

## 5. Datos del dashboard

| ID | Información | Obligatoria | Filtro aplicado |
| --- | --- | --- | --- |
| DAT-REP-001 | KPIs operativos actuales | Sí | companyId + branchId |
| DAT-REP-002 | KPIs financieros del período seleccionado | Condicional | companyId + branchId + rango de fechas |
| DAT-REP-003 | Rango de fechas del informe (inicio / fin) | Para financiero | Máximo 90 días (BR-REP-005) |
| DAT-REP-004 | Actividad reciente (últimos 10 eventos) | Sí | companyId + branchId, por fecha DESC |

---

## 6. Escenarios Gherkin

```gherkin
Feature: Dashboard operativo por rol
  Scenario: Gerente de operaciones ve KPIs de su empresa
    Given el usuario tiene rol OPS_MANAGER y permiso REPORT.READ_OPERATIONAL
    And está autenticado en empresa A, sede Lima
    When accede al módulo de Reportes
    Then ve los KPIs de empresa A, sede Lima
    And no ve datos de empresa B

  Scenario: Cajero sin permiso de reportes operativos
    Given el usuario tiene rol CASHIER sin permiso REPORT.READ_OPERATIONAL
    When intenta acceder al módulo de Reportes
    Then el sistema devuelve 403 Forbidden
    And no se muestra ningún dato

Feature: Exportación con rango máximo
  Scenario: Exportación dentro del límite de 90 días
    Given el usuario tiene permiso REPORT.EXPORT
    When solicita exportación con rango de 60 días
    Then recibe el archivo CSV con los datos del período

  Scenario: Exportación que excede 90 días es rechazada
    Given el usuario tiene permiso REPORT.EXPORT
    When solicita exportación con rango de 120 días
    Then el sistema devuelve error de validación
    And indica que el máximo permitido es 90 días
```

---

## 7. Preguntas abiertas

| ID | Pregunta | Estado |
| --- | --- | --- |
| OQ-REP-001 | ¿El `CORPORATE_AUDITOR` puede ver KPIs consolidados de todas las empresas del grupo o solo de una empresa a la vez? | `ABIERTA` — definir en siguiente iteración |
| OQ-REP-002 | ¿Existe un reporte de rentabilidad por vehículo (ingresos por alquileres del vehículo X en el período)? | `ABIERTA` — no implementar hasta decisión |
| OQ-REP-003 | ¿Los reportes deben cachearse en servidor o calcularse en cada request? | `ABIERTA` — depende del volumen de datos; resolver con TDD |
