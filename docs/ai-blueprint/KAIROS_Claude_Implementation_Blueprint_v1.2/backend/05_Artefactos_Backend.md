# Artefactos requeridos — Backend y Datos

## Contratos y diseño

- `packages/contracts/openapi/{module}.yaml` para todos los módulos.
- `packages/contracts/events/{event}.v1.schema.json`.
- Catálogo de errores estable por módulo.
- ADR independientes para toda decisión propuesta.
- Matriz API → permiso → MFA → auditoría → idempotencia.

## Persistencia

- `apps/api/prisma/schema.prisma` modularizado según capacidad soportada.
- `apps/api/prisma/migrations/*/migration.sql`.
- SQL explícito para `EXCLUDE`, partial indexes, checks, RLS y políticas.
- Diccionario de datos y clasificación PII.
- Seeds idempotentes sin datos reales.
- Plan y journal de migración histórica, conciliación, corte/delta y forward-fix.

## Código

- Módulos bajo `apps/api/src/modules/{module}/{domain,application,presentation,infrastructure}`.
- Value objects y errores compartidos mínimos.
- Puertos explícitos; ningún repositorio cross-module.
- Idempotency store, audit events, outbox publisher y workers Cloud Tasks.
- Adaptadores Firebase Auth, GCS, RENIEC/MTC, pagos/mensajería y Motrix manual según alcance.

## Pruebas

- Unitarias de dominio/handlers.
- Integración PostgreSQL real con Testcontainers.
- Contract tests OpenAPI y eventos.
- E2E HTTP.
- Concurrencia `CONC-001`.
- Seguridad multiempresa negativa `TEST-*-SEC-001` por módulo.
- Idempotencia, retry, duplicados y fallos externos.
- Restore/backup y migración N-1→N.

## Operación

- Dockerfiles y configuración Cloud Run.
- Workflows GitHub Actions.
- SBOM y reportes de seguridad.
- Dashboards/alertas de latencia, error, outbox, Cloud Tasks, DB y storage.
- Runbooks: DB, outbox, Firebase, GCS, RENIEC/MTC, pagos, restore, migración y rollback.

## Matriz mínima por módulo

| Módulo | Migración | OpenAPI | Eventos | Tests críticos |
|---|---:|---:|---:|---:|
| Customers | Sí | Sí | Si produce | Tenant/documentos/RENIEC |
| Fleet | Sí | Sí | Sí | Disponibilidad/concurrencia/GPS |
| Inquiries | Sí | Sí | Sí | Registro/cotización/conversión |
| Reservations | Sí | Sí | Sí | Confirmación/no-show/venta |
| Rentals | Sí | Sí | Sí | Validación/notaría/entrega/ampliación |
| Returns | Sí | Sí | Sí | Custodia/daño/garantía/cierre |
| Payments | Sí | Sí | Sí | Exactitud/idempotencia/autorización |
| Evidence | Sí | Sí | Sí | Upload temporal/integridad/offline |
| Recruitment | Sí | Sí | Sí | Decisión/incorporación |
| HR Administration | Sí | Sí | Sí | Vacaciones/cascada/terminación |
| Notifications/Audit/Reporting | Sí | Sí | Según aplique | Inmutabilidad/permisos/PII |

## Entregable por slice

Cada slice entrega migración, contrato, implementación, pruebas, trazabilidad, evidencia de seguridad, observabilidad y runbook cuando aplique. No se considera terminado si solo compila.
