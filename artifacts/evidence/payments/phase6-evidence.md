# Evidencia — Módulo Payments (Fase 6)

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
Resultado: 0 errores, 0 warnings en módulo payments
```

### Tests unitarios
```
npm run test:api -- --testPathPattern="payments"
Resultado: ver suite completa (1197 passed en erp-monolithic-api)
```

---

## Endpoints verificados (estructura)

| Endpoint | Handler | Autorización |
|---|---|---|
| GET /payments/deposits | ListDepositsHandler | PAYMENT.READ_LIST vía PaymentAccessService |
| GET /payments/deposits/summary | GetDepositsSummaryHandler | PAYMENT.READ_LIST vía PaymentAccessService |
| GET /payments/deposits/:id | GetDepositHandler | PAYMENT.READ_DETAIL vía PaymentAccessService |
| POST /payments/deposits/:id/adjustments | RegisterAdjustmentHandler | PAYMENT.REGISTER_ADJUSTMENT |
| POST /payments/deposits/:id/approve-refund | ApproveRefundHandler | PAYMENT.APPROVE_REFUND |
| POST /payments/deposits/:id/close | CloseFinancialHandler | PAYMENT.CLOSE_FINANCIAL |

## Aislamiento multiempresa

Todos los handlers filtran por `rental.operatingCompanyId = scope.companyId` y `rental.branchId = scope.branchId` en cada query Prisma.

## Idempotencia

Los tres comandos POST usan `@UseInterceptors(IdempotencyInterceptor)`.
