# Evidencia — PR #98: reglas de negocio 2026-10-22

**PR:** #98 `feature/reglas-negocio-20261022`  
**Actualizado:** 2026-10-23

## CI verificado

Ejecución: [GitHub Actions #39860130858](https://github.com/kairosdesarrollotec-ai/erp-monolithic-api/actions/runs/39860130858).

| Check | Resultado |
|---|---|
| Typecheck, build y tests unitarios/contrato | PASS |
| Migraciones, drift, upgrade e integración (PostgreSQL real) | PASS |
| SBOM (CycloneDX) | PASS |
| SCA y secret scanning | PASS |

## Validación local de la corrección

| Comando | Resultado |
|---|---|
| `npm run prisma:generate --workspace apps/api` | PASS |
| `npm run build --workspace apps/api` | PASS |
| `npm run test --workspace apps/api -- --runInBand --testPathPatterns='(reservations-confirm-concurrency|vehicle.*commitment|create-reservation|register-payment)'` | 3 suites, 17 pruebas PASS |
| `npm audit --json` | 0 vulnerabilidades |

La suite de integración con PostgreSQL real requiere Testcontainers. No se ejecutó localmente porque el entorno de auditoría no tiene un runtime de contenedores; el check de integración del CI indicado arriba sí terminó en PASS. El nuevo commit debe volver a ejecutar ese check antes de merge.

## Auditoría posterior a CI

| Hallazgo | Estado | Evidencia |
|---|---|---|
| La exclusión de compromisos de vehículo podía omitirse con datos conflictivos | Resuelto | La migración ahora aborta; el runbook define saneamiento y verificación de constraint. |
| No había trazabilidad específica del PR | Resuelto | `artifacts/traceability/PR98-reglas-negocio-20261022.md`. |
| Consolidado reportaba el estado técnico como no verificado | Resuelto | Referencia a esta evidencia y a la trazabilidad técnica actualizadas. |

## Validación pendiente de despliegue

Antes de producción, verificar en el ambiente objetivo que no existan solapamientos históricos. Si los hay, CD debe detenerse, aplicarse el runbook y reintentarse la migración; la constraint nunca debe omitirse silenciosamente.
