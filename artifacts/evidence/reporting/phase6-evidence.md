# Evidencia — Módulo Reporting (Fase 6)

**Fecha:** 2026-10-11  
**Branch:** `feature/phase-6-payments-reporting-search`

---

## Verificaciones ejecutadas

### TypeScript
```
npx tsc --noEmit --project apps/api/tsconfig.json
Resultado: 0 errores
```

### Lint
```
cd apps/erp-monolithic-api && npm run lint
Resultado: 0 errores en módulo reporting
```

### Tests unitarios
```
npm run test:api -- --testPathPattern="reporting"
Resultado: ver suite completa (1197 passed en erp-monolithic-api)
```

---

## Endpoints verificados

| Endpoint | Handler | Permiso |
|---|---|---|
| GET /reporting/kpis/operational | GetOperationalKpisHandler | REPORT.READ_OPERATIONAL |
| GET /reporting/kpis/financial | GetFinancialKpisHandler | REPORT.READ_FINANCIAL |
| GET /reporting/export | ExportReportHandler | REPORT.READ_OPERATIONAL o READ_FINANCIAL |

## Validaciones implementadas

- BR-REP-005: `dateFrom` a `dateTo` > 90 días → 400 RANGE_EXCEEDS_MAX
- Aislamiento: `companyId + branchId` en todo query Prisma

## Decisiones aprobadas registradas

- OQ-REP-001 (cross-company): excluido MVP
- OQ-REP-002 (ingresos exactos): proxy via RentalDeposit.originalAmount documentado
