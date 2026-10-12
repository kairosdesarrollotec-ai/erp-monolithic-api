# SDD — 09 Reportes

# Solution Design Document — Reportes

**Código:** SDD-KAIROS-MVP-REP-001 **Versión:** 1.0 (creado 11-oct-2026 — base usable inicial) **Estado:** DRAFT — base usable, pendiente de revisión formal **Entrada funcional:** `BDD-REP-001` v1.0 **Depende de:** `SDD-KAIROS-TRANSVERSAL.md` **Alcance:** Dashboard operativo, financiero y exportación de datos **Fecha:** 11 de octubre de 2026

---

## 1. Control y gobernanza

### 1.1 Historial

| Versión | Cambio | Estado |
| --- | --- | --- |
| 1.0 | Creación inicial — base usable a partir de BDD-REP-001 y módulos existentes | DRAFT |

### 1.2 Documentos relacionados

| Documento | Relación |
| --- | --- |
| `BDD-REP-001` v1.0 | Fuente funcional autoritativa |
| `SDD-KAIROS-TRANSVERSAL.md` | Arquitectura base común; §"Reporting: Proyecciones de lectura y KPI" |
| `TDD-REP-001` | Refinamiento técnico |

---

## 2. Resumen ejecutivo

Reportes es un módulo de **solo lectura** que agrega proyecciones sobre los datos existentes del ERP para proveer visibilidad operativa y financiera. No duplica datos en tablas separadas — calcula KPIs mediante queries directas sobre los modelos de dominio existentes (`rentals`, `returns`, `reservations`, `vehicles`, `vehicle_commitments`, `incidents`, `rental_deposits`).

La arquitectura de este módulo sigue el patrón de **reporting views** definido en `SDD-KAIROS-TRANSVERSAL.md`: queries de lectura optimizadas, sin comandos de dominio, sin estado propio.

---

## 3. Alcance

### 3.1 Incluido

- KPIs operativos en tiempo real: alquileres activos, devoluciones pendientes, flota disponible, reservas activas, incidencias abiertas.
- KPIs financieros por período: garantías retenidas, liberadas, monto total.
- Actividad reciente: últimos N eventos del módulo (alquileres, devoluciones, reservas).
- Exportación CSV de garantías por período (máx. 90 días — BR-REP-005).

### 3.2 Excluido

- Reportes de RRHH (nómina, vacaciones) — otro módulo.
- BI externo o dashboards embebidos (Metabase, Looker, etc.) — fuera del MVP.
- Reportes de rentabilidad por vehículo — OQ-REP-002, sin BDD que lo defina.
- Reportes multi-empresa consolidados — OQ-REP-001, sin BDD que lo defina.

---

## 4. Casos de uso

### UC-REP-001 — Ver dashboard operativo

**Actor:** Ops Manager / Company Admin / Corporate Auditor  
**Permiso:** `REPORT.READ_OPERATIONAL`  
**Pasos:**
1. El sistema calcula cada KPI operativo filtrando por `companyId` + `branchId` del actor.
2. Retorna los KPIs en una sola respuesta (no paginada).

**Postcondición:** KPIs visibles, sin datos de otras empresas.

---

### UC-REP-002 — Ver dashboard financiero

**Actor:** Finance Approver / Company Admin / Corporate Auditor  
**Permiso:** `REPORT.READ_FINANCIAL`  
**Pasos:**
1. Actor selecciona rango de fechas (máx. 90 días).
2. El sistema calcula KPIs financieros sobre `rental_deposits` + `rental_deposit_adjustments` en el rango.
3. Retorna: suma de garantías retenidas, suma devueltas, suma retenidas definitivamente.

**Postcondición:** KPIs financieros del período visibles.

---

### UC-REP-003 — Exportar datos

**Actor:** Finance Approver / Company Admin  
**Permiso:** `REPORT.EXPORT`  
**Pasos:**
1. Actor selecciona tipo de reporte (garantías) y rango de fechas (máx. 90 días).
2. Sistema valida rango <= 90 días (BR-REP-005); si supera, devuelve 422 con mensaje.
3. Sistema genera CSV con campos: rentalId, clienteName, status, originalAmount, adjustments, finalAmount, closedAt.
4. Devuelve el CSV como descarga directa.

**Postcondición:** Archivo CSV descargable.

---

## 5. Módulo NestJS propuesto

- **Módulo:** `reporting` (nuevo, dentro de `apps/api/src/modules/`)
- **Dominio:** Sin entidades propias — solo queries de proyección
- **Puertos:** `IReportingRepository` (abstracción de las queries de lectura)
- **Adaptadores:** Prisma — queries sobre tablas existentes, sin tablas nuevas en el MVP
- **Presentación:** `ReportingController` con endpoints bajo `/reporting`

> No se requieren migraciones para el MVP de Reportes — todas las tablas de origen ya existen.

---

## 6. OpenAPI (esquema de endpoints necesarios)

| Método | Ruta | Permiso | Descripción |
| --- | --- | --- | --- |
| `GET` | `/reporting/operational-kpis` | `REPORT.READ_OPERATIONAL` | KPIs operativos actuales |
| `GET` | `/reporting/financial-kpis` | `REPORT.READ_FINANCIAL` | KPIs financieros del período |
| `GET` | `/reporting/activity` | `REPORT.READ_OPERATIONAL` | Últimos N eventos de actividad |
| `GET` | `/reporting/export/deposits` | `REPORT.EXPORT` | Exportar garantías como CSV |

> STOP `MISSING_API_CONTRACT`: el contrato OpenAPI formal **no existe aún**. Estos endpoints son la propuesta. No implementar frontend hasta formalizar el contrato.

---

## 7. Seguridad y multiempresa

- Todo endpoint de reportes filtra por `companyId` del actor autenticado.
- `CORPORATE_AUDITOR` y `PLATFORM_ADMIN` pueden especificar `companyId` explícito como parámetro de query; los demás roles usan el `companyId` de su sesión sin opción de override.
- No se expone PII detallada en los KPIs agregados (solo conteos y montos).
- La exportación CSV no incluye datos biométricos ni documentos completos.
