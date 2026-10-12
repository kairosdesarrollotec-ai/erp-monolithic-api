# Trazabilidad — Módulo Reporting (UC-REP-001)

**Slice:** Reportes — KPIs operativos, KPIs financieros y exportación CSV  
**Branch:** `feature/phase-6-payments-reporting-search`  
**Fecha:** 2026-10-11

---

## Cadena de trazabilidad

```
BDD → SDD → TDD → OpenAPI → código → pruebas → evidencia
```

### BDD

| ID | Archivo | Módulo |
|---|---|---|
| BDD-REP-001 | `docs/sources/bdd/bdd-09-reportes.md` | Reportes |

### SDD

| ID | Archivo | Módulo |
|---|---|---|
| SDD-REP-001 | `docs/sources/sdd/sdd-09-reportes.md` | Reportes |

### TDD

| ID | Archivo | Módulo |
|---|---|---|
| TDD-REP-001 | `docs/sources/tdd/tdd-09-reportes.md` | Reportes |

### OpenAPI

| ID | Archivo | Versión |
|---|---|---|
| OPENAPI-REPORTING-V0.1.0 | `packages/contracts/openapi/reporting.yaml` | 0.1.0 |

---

## Casos de uso cubiertos

| UC | Descripción | Permiso |
|---|---|---|
| UC-REP-001 | Obtener KPIs operativos del período | REPORT.READ_OPERATIONAL |
| UC-REP-002 | Obtener KPIs financieros del período | REPORT.READ_FINANCIAL |
| UC-REP-003 | Exportar reporte en CSV | REPORT.READ_OPERATIONAL o REPORT.READ_FINANCIAL |

### Reglas de negocio cubiertas

| BR | Descripción |
|---|---|
| BR-REP-001 | Los KPIs se calculan para el rango dateFrom–dateTo |
| BR-REP-003 | Aislamiento multiempresa: companyId + branchId del actor |
| BR-REP-005 | El rango de fechas no puede superar 90 días (RANGE_EXCEEDS_MAX) |

### Exclusiones aprobadas (decision-log)

| Item | Decisión |
|---|---|
| Vista cross-company para PLATFORM_ADMIN/CORPORATE_AUDITOR (OQ-REP-001) | Excluido del MVP |
| Datos de ingresos por alquiler desde tabla Rental (OQ-REP-002) | Proxy via RentalDeposit.originalAmount documentado como limitación |

---

## Código implementado

| Capa | Ruta |
|---|---|
| Módulo | `apps/api/src/modules/reporting/` |
| Controller | `apps/api/src/modules/reporting/presentation/http/reporting.controller.ts` |
| Queries/Handlers | `apps/api/src/modules/reporting/application/queries/` |
| Domain | `apps/api/src/modules/reporting/domain/` |
| DTOs | `apps/api/src/modules/reporting/presentation/http/dto/` |

### Endpoints implementados

| Método | Ruta | Handler |
|---|---|---|
| GET | `/reporting/kpis/operational` | `GetOperationalKpisHandler` |
| GET | `/reporting/kpis/financial` | `GetFinancialKpisHandler` |
| GET | `/reporting/export` | `ExportReportHandler` |

---

## Pruebas

| Tipo | Ruta | Estado |
|---|---|---|
| Unitarias (get-operational-kpis) | `apps/api/src/modules/reporting/application/queries/get-operational-kpis.handler.spec.ts` | ✅ 7/7 passing |

### Invariantes cubiertas

| Invariante | Test | Estado |
|---|---|---|
| P0 Multitenancy (BR-REP-004) | Las 6 calls Prisma incluyen `operatingCompanyId` | ✅ |
| BR-REP-005 rango > 90 días | RANGE_EXCEEDS_MAX + INVALID_DATE_RANGE | ✅ |
| BR-REP-005 exactamente 90 días | Sin excepción | ✅ |
| BR-REP-001 permiso REPORT.READ_OPERATIONAL | ForbiddenException cuando denegado | ✅ |
| Estructura de respuesta | companyId, branchId, kpis, generatedAt | ✅ |

---

## Evidencia

- Módulo NestJS: `apps/api/src/modules/reporting/reporting.module.ts`
- Contrato OpenAPI: `packages/contracts/openapi/reporting.yaml` v0.1.0
- TypeScript: 0 errores
- Lint: 0 errores

---

## Riesgos y pendientes

| Item | Estado |
|---|---|
| Tests para GetFinancialKpisHandler y ExportReportHandler | Pendiente |
| Vista cross-company (OQ-REP-001) | Excluido MVP |
| Ingresos exactos por alquiler (OQ-REP-002) | Documentado como limitación conocida |
