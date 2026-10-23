# Trazabilidad — PR #98: reglas de negocio 2026-10-22

**Rama:** `feature/reglas-negocio-20261022`  
**Alcance:** ajustes aditivos de Consulta, Reserva, Alquiler, Devolución, Reclutamiento, Administración de Personal, Evidencia y Transversal.  
**Cadena:** BDD → SDD → TDD → OpenAPI → código → pruebas → evidencia.

## Fuentes vigentes

| Dominio | BDD | SDD | TDD | Contrato |
|---|---|---|---|---|
| Reserva | `docs/sources/bdd/bdd-02-reserva.md` | `docs/sources/sdd/sdd-02-reserva.md` | `docs/sources/tdd/tdd-02-reserva.md` | `packages/contracts/openapi/reservations.yaml` |
| Alquiler | `docs/sources/bdd/bdd-03-alquiler.md` | `docs/sources/sdd/sdd-03-alquiler.md` | `docs/sources/tdd/tdd-03-alquiler.md` | `packages/contracts/openapi/rentals.yaml` |
| Devolución | `docs/sources/bdd/bdd-04-devolucion.md` | `docs/sources/sdd/sdd-04-devolucion.md` | `docs/sources/tdd/tdd-04-devolucion.md` | `packages/contracts/openapi/returns.yaml` |
| Reclutamiento | `docs/sources/bdd/bdd-05-reclutamiento-y-seleccion.md` | `docs/sources/sdd/sdd-05-reclutamiento-y-seleccion.md` | `docs/sources/tdd/tdd-05-reclutamiento-y-seleccion.md` | `packages/contracts/openapi/recruitment.yaml` |
| Administración de Personal | `docs/sources/bdd/bdd-06-administracion-de-personal.md` | `docs/sources/sdd/sdd-06-administracion-de-personal.md` | `docs/sources/tdd/tdd-06-administracion-de-personal.md` | `packages/contracts/openapi/hr-administration.yaml` |
| Transversal / Evidencia | `docs/sources/bdd/bdd-00-transversal.md` | `docs/sources/sdd/sdd-00-transversal.md` | `docs/sources/tdd/tdd-00-transversal.md` | `packages/contracts/openapi/evidence.yaml`, `packages/contracts/openapi/transversal.yaml` |

## Cambios y verificación

| Cambio | Regla / decisión | Código y contrato | Prueba / evidencia |
|---|---|---|---|
| Pago y comprobantes de Reserva/garantía | DEC-RES-PAYPROOF-001, DEC-ALQ-PAYPROOF-001 | `reservations`, `rentals`, migración `20261022010001_*`; OpenAPI de Reserva y Alquiler | specs de handlers de reserva/alquiler y CI de PR #98 |
| Cancelación de alquiler y tercera vía notarial | DEC-ALQ-CANCEL-001, DEC-ALQ-THIRDPATH-001 | `rentals`, migraciones `20261022010002_*`, `20261022010003_*`; `rentals.yaml` | specs de handlers y contrato de Rentals |
| Doble aprobación para borrar evidencia | DEC-EVID-DELETE-002 | módulo `evidence`, migración `20261021020001_*`, `evidence.yaml` | `evidence-deletion-handlers.spec.ts`, `evidence-openapi.contract.spec.ts` |
| Autoservicio de asistencia y geocerca | Respuestas de negocio 22-oct #9; BR-ADP-001 | módulo `hr-administration`, migración `20261022020002_*`, `hr-administration.yaml` | `self-attendance.spec.ts`, `attendance-self-service-rules.spec.ts`, contrato HR |
| Reprogramar/cancelar vacaciones | Respuestas de negocio 22-oct #10; BR-ADP-002 | handlers de vacaciones, migración `20261022020003_*`, `hr-administration.yaml` | `hr-administration-handlers.spec.ts`, contrato HR |
| Vacante por término y cancelación | REC-02 | módulo `recruitment`, migración `20261022020001_*`, `recruitment.yaml` | `recruitment-process-state-handlers.spec.ts`, contrato Recruitment |
| Marcas por zona de devolución | PD-07 | módulo `returns`, migración `20261022040001_*`, `returns.yaml` | `record-zone-marks.handler.spec.ts`, contrato Returns |
| No solapamiento de vehículo | NFR-KAI-001 / TDD-RES §9.2, §10.1 | migración `20261022030001_*` | CI de migraciones; runbook `docs/runbooks/vehicle-commitment-overlap-remediation.md` |

## Límites conocidos

Este artefacto no declara como completadas las funcionalidades que el consolidado mantiene como pendientes. Las decisiones de negocio aún abiertas se conservan como pendientes y no se sustituyen por esta trazabilidad técnica.
