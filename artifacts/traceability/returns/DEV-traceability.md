# Trazabilidad — Módulo Devolución (UC-DEV-001 a UC-DEV-005 / DEV-P01..DEV-P10)

**Slice:** Devolución — recepción provisional, alcolímetro, inspección, daños y cierre financiero  
**PR:** #54 (`feature/returns-module-api`)  
**Fecha:** 2026-10-06

---

## Cadena de trazabilidad

```
BDD → SDD → TDD → OpenAPI → código → pruebas → evidencia
```

### BDD

| ID | Archivo | Módulo |
|---|---|---|
| BDD-KAIROS-MVP-002-DEV | `docs/sources/bdd/bdd-04-devolucion.md` | Devolución |

### SDD

| ID | Archivo | Módulo |
|---|---|---|
| SDD-KAIROS-MVP-002-DEV | `docs/sources/sdd/sdd-04-devolucion.md` | Devolución |

### TDD

| ID | Archivo | Módulo |
|---|---|---|
| TDD-KAIROS-MVP-002-DEV | `docs/sources/tdd/tdd-04-devolucion.md` | Devolución |

### OpenAPI

| ID | Archivo | Versión |
|---|---|---|
| OPENAPI-RETURNS-V1.1.0 | `packages/contracts/openapi/returns.yaml` | 1.1.0 |

---

## Casos de uso cubiertos

Los documentos fuente definen 5 casos de uso (UC-DEV-001..005) que corresponden
a 10 pasos de proceso (DEV-P01..DEV-P10) según la tabla de pasos del BDD.

| UC-TDD | BDD (pasos) | BRs | Descripción | Handlers implementados |
|---|---|---|---|---|
| UC-DEV-001 | DEV-P01, DEV-P02, DEV-P03 | BR-DEV-004, BR-DEV-005 | Coordinar y recibir el vehículo (incluye alcolímetro) | `CreateReturnHandler`, `ReceiveProvisionalHandler`, `RegisterAlcoholTestHandler`, `ResolveAlcoholEscalationHandler` |
| UC-DEV-002 | DEV-P04 | BR-DEV-009 | Ejecutar checklist de retorno (inspección + documento de responsabilidad) | `CompleteInspectionHandler` |
| UC-DEV-003 | DEV-P05, DEV-P07, DEV-P08, DEV-P09 | BR-DEV-006, BR-DEV-007 | Evaluar daño y resolver garantía | `AssessDamageHandler` |
| UC-DEV-004 | DEV-P07 (>24h) | BR-DEV-011 | Cobrar días de paralización | `ChargeImmobilizationHandler` |
| UC-DEV-005 | DEV-P06, DEV-P10 | BR-DEV-001, BR-DEV-002 | Archivar expediente / cierre financiero | `CloseFinancialHandler`, `CloseReturnHandler` |

---

## Código implementado

| Capa | Ruta |
|---|---|
| Módulo | `apps/api/src/modules/returns/` |
| Controller | `apps/api/src/modules/returns/presentation/http/returns.controller.ts` |
| Commands (UC-DEV-001) | `apps/api/src/modules/returns/application/commands/create-return.handler.ts` |
| Commands (UC-DEV-001) | `apps/api/src/modules/returns/application/commands/receive-provisional.handler.ts` |
| Commands (UC-DEV-001) | `apps/api/src/modules/returns/application/commands/register-alcohol-test.handler.ts` |
| Commands (UC-DEV-001) | `apps/api/src/modules/returns/application/commands/resolve-alcohol-escalation.handler.ts` |
| Commands (UC-DEV-001 evidence) | `apps/api/src/modules/returns/application/commands/record-return-evidence.handler.ts` |
| Commands (UC-DEV-001 evidence) | `apps/api/src/modules/returns/application/commands/request-return-evidence-upload-session.handler.ts` |
| Commands (UC-DEV-002) | `apps/api/src/modules/returns/application/commands/complete-inspection.handler.ts` |
| Commands (UC-DEV-003) | `apps/api/src/modules/returns/application/commands/assess-damage.handler.ts` |
| Commands (UC-DEV-004) | `apps/api/src/modules/returns/application/commands/charge-immobilization.handler.ts` |
| Commands (UC-DEV-005) | `apps/api/src/modules/returns/application/commands/close-financial.handler.ts` |
| Commands (UC-DEV-005) | `apps/api/src/modules/returns/application/commands/close-return.handler.ts` |
| Queries | `apps/api/src/modules/returns/application/queries/get-return.handler.ts` |
| Queries | `apps/api/src/modules/returns/application/queries/list-returns.handler.ts` |
| Queries | `apps/api/src/modules/returns/application/queries/get-cosmetic-tariff.handler.ts` |
| Queries | `apps/api/src/modules/returns/application/queries/list-return-evidence.handler.ts` |
| Policies | `apps/api/src/modules/returns/application/policies/return-role-policy.ts` |
| Domain | `apps/api/src/modules/returns/domain/` |
| Infrastructure | `apps/api/src/modules/returns/infrastructure/` |

### Migraciones

| Archivo | Contenido |
|---|---|
| `apps/api/prisma/migrations/20261005000000_add_returns_module/migration.sql` | Tablas `returns`, `return_damages`, `immobilization_charges`, `return_evidence`; enums `ReturnStatus`, `CustodyHolder`, `DamageOrigin`, `DamageSeverity`, `ReturnFuelLevel`, `ReturnEvidenceType` |
| `apps/api/prisma/migrations/20261005120000_returns_alcohol_escalation_responsibility/migration.sql` | Enum `AlcoholEscalationDecision`; columnas `alcohol_escalation_*` y `responsibility_*` en `returns` (PROP-014, PROP-015) |
| `apps/api/prisma/migrations/20261005130000_returns_fix_index_names/migration.sql` | Renombrado de índices para alinear con Prisma (drift de nombres a 63 caracteres) |

---

## Pruebas

| Tipo | Ruta |
|---|---|
| Unitarias (domain) | `apps/api/src/modules/returns/domain/damage-calculator.spec.ts` |
| Unitarias (domain) | `apps/api/src/modules/returns/domain/responsibility-document.spec.ts` |
| Unitarias (domain) | `apps/api/src/modules/returns/domain/return-status.spec.ts` |
| Unitarias (domain) | `apps/api/src/modules/returns/domain/damage-assessment.spec.ts` |
| Unitarias (domain) | `apps/api/src/modules/returns/domain/return-settlement.spec.ts` |
| Unitarias (domain) | `apps/api/src/modules/returns/domain/customer-risk-status.spec.ts` |
| Unitarias (domain) | `apps/api/src/modules/returns/domain/return-rules.spec.ts` |
| Unitarias (application — commands) | `apps/api/src/modules/returns/application/commands/create-return.handler.spec.ts` |
| Unitarias (application — commands) | `apps/api/src/modules/returns/application/commands/receive-provisional.handler.spec.ts` |
| Unitarias (application — commands) | `apps/api/src/modules/returns/application/commands/register-alcohol-test.handler.spec.ts` |
| Unitarias (application — commands) | `apps/api/src/modules/returns/application/commands/resolve-alcohol-escalation.handler.spec.ts` |
| Unitarias (application — commands) | `apps/api/src/modules/returns/application/commands/complete-inspection.handler.spec.ts` |
| Unitarias (application — commands) | `apps/api/src/modules/returns/application/commands/assess-damage.handler.spec.ts` |
| Unitarias (application — commands) | `apps/api/src/modules/returns/application/commands/charge-immobilization.handler.spec.ts` |
| Unitarias (application — commands) | `apps/api/src/modules/returns/application/commands/close-financial.handler.spec.ts` |
| Unitarias (application — commands) | `apps/api/src/modules/returns/application/commands/close-return.handler.spec.ts` |
| Unitarias (application — commands, evidence) | `apps/api/src/modules/returns/application/commands/return-evidence.handlers.spec.ts` |
| Unitarias (application — queries) | `apps/api/src/modules/returns/application/queries/return-queries.handlers.spec.ts` |
| Unitarias (application — policies) | `apps/api/src/modules/returns/application/policies/return-role-policy.spec.ts` |
| Unitarias (infrastructure) | `apps/api/src/modules/returns/infrastructure/persistence/return-persistence.mapper.spec.ts` |
| Unitarias (infrastructure) | `apps/api/src/modules/returns/infrastructure/persistence/prisma-return.repository.spec.ts` |
| Unitarias (infrastructure) | `apps/api/src/modules/returns/infrastructure/persistence/prisma-return-customer-risk.persistence.spec.ts` |
| Unitarias (infrastructure) | `apps/api/src/modules/returns/infrastructure/persistence/prisma-return-deposit-settlement.persistence.spec.ts` |
| Contrato OpenAPI | `apps/api/src/modules/returns/presentation/http/returns-openapi.contract.spec.ts` |

---

## Evidencia

- Ver `artifacts/evidence/returns/PR54-evidence.md`

---

## Decisiones documentadas

| ID | Descripción | Estado |
|---|---|---|
| PROP-014 | Resolución de Gerencia ante alcolímetro DESFAVORABLE/RECHAZADO (BR-DEV-005) | PROVISIONAL — pendiente confirmación de negocio |
| PROP-015 | Documento de responsabilidad firmado (BR-DEV-009, DAT-DEV-005, EX-DEV-001) | PROVISIONAL — pendiente aprobación Legal |
| PENDIENTE-DEV-CANCELADA | Estado `CANCELADA` en enum `ReturnStatus` no documentado en BDD ni TDD | PENDIENTE_APROBACION_DOCUMENTAL |

---

## Riesgos y pendientes

1. **Tests de integración**: no se ejecutaron tests contra BD real. Requieren Testcontainers (PostgreSQL). Se ejecutarán en el gate de QA.
2. **Estado CANCELADA**: presente en enum `ReturnStatus` (migración + `return-status.ts`) pero sin documentación en BDD §11.2 ni TDD §8.1/8.2. Ver `PENDIENTE-DEV-CANCELADA` en decision-log.md.
3. **PROP-014 y PROP-015**: implementaciones provisionales pendientes de validación formal del área de Negocio y Legal respectivamente.
4. **Mapper e infraestructura tests**: 3 specs de infraestructura/contrato fallan en el entorno del worktree por ausencia del cliente Prisma generado (`@prisma/client` no exporta `$Enums` sin `prisma generate`). Esta es una condición de entorno, no un defecto del código del PR.
