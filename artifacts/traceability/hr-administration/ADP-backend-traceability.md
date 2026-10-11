# Trazabilidad Backend — Módulo Administración de Personal
**PR:** #69 `feature/hr-administration-api`  
**Commit:** `8e39d04`  
**Fecha:** 2026-10-10

---

## Fuentes verificadas

| ID | Tipo | Versión | Status |
|----|------|---------|--------|
| BDD-KAIROS-MVP-002-ADP | BDD | 1.9 | approved (2026-10-10) |
| SDD-KAIROS-MVP-002-ADP | SDD | 2.1 | approved (2026-10-10) |
| TDD-KAIROS-MVP-002-ADP | TDD | 2.1 | approved (2026-10-01) |
| OPENAPI-HR-ADMINISTRATION-V0.1.0 | OpenAPI | 0.1.0 | en source-manifest (2026-10-10) |

---

## Cadena BDD → código → prueba por caso de uso

### Gestión de empleados (ADP-P01 / BR-ADP-001 base)

| BDD | SDD | Código | Prueba |
|-----|-----|--------|--------|
| ADP-P01 CreateEmployee | SDD-ADP §3.1 | `commands/create-employee.handler.ts` | `hr-administration-handlers.spec.ts` |
| ADP-P01 UpdateEmployee | SDD-ADP §3.2 | `commands/update-employee.handler.ts` | `hr-administration-handlers.spec.ts` |
| ADP-P01 GetEmployee | SDD-ADP §3.3 | `queries/get-employee-detail.handler.ts` | — (query, sin spec unitaria) |
| ADP-P01 ListEmployees | SDD-ADP §3.4 | `queries/list-employees.handler.ts` | — (query, sin spec unitaria) |

### BR-ADP-001 — Asistencia y descuento salarial

| BDD | TDD ref | Código | Prueba |
|-----|---------|--------|--------|
| BR-ADP-001 LogAttendance | TDD-ADP §4 | `commands/log-attendance.handler.ts` | `hr-administration-handlers.spec.ts` |
| BR-ADP-001 ApplyMonthDeductions | TDD-ADP §4 | `commands/apply-month-deductions.handler.ts` | `hr-administration-handlers.spec.ts` |
| BR-ADP-001 GetAttendance | TDD-ADP §4 | `queries/get-employee-attendance.handler.ts` | — |
| BR-ADP-001 GetAttendanceSummary | TDD-ADP §4 | `queries/get-attendance-summary.handler.ts` | — |

### BR-ADP-002 — Vacaciones sin solapamiento por área

| BDD | TDD ref | Código | Prueba |
|-----|---------|--------|--------|
| BR-ADP-002 ScheduleVacation | TDD-ADP §4, §9.2 | `commands/schedule-vacation.handler.ts` | `hr-administration-handlers.spec.ts` |
| BR-ADP-002 EXCLUDE constraint | TDD-ADP §9.2 | `migrations/20261008000001_vacation_requests_area_exclusion/migration.sql` | Constraint DB (race condition) |
| BR-ADP-002 GetVacationsCalendar | TDD-ADP §4 | `queries/get-vacations-calendar.handler.ts` | — |
| BR-ADP-002 GetEmployeeVacations | TDD-ADP §4 | `queries/get-employee-vacations.handler.ts` | — |

### BR-ADP-003 — Permiso de ausentismo

| BDD | TDD ref | Código | Prueba |
|-----|---------|--------|--------|
| BR-ADP-003 RequestLeave | TDD-ADP §4 | `commands/request-leave.handler.ts` | `hr-administration-handlers.spec.ts` |
| BR-ADP-003 ResolveLeave | TDD-ADP §4 | `commands/resolve-leave.handler.ts` | `hr-administration-handlers.spec.ts` |
| BR-ADP-003 GetEmployeeLeaves | TDD-ADP §4 | `queries/get-employee-leaves.handler.ts` | — |

### BR-ADP-004 — Salida a campo con cascada 3 niveles

| BDD | TDD ref | Código | Prueba |
|-----|---------|--------|--------|
| BR-ADP-004 RequestFieldTrip | TDD-ADP §4 | `commands/request-field-trip.handler.ts` | `hr-administration-handlers.spec.ts` |
| BR-ADP-004 AuthorizeFieldTrip | TDD-ADP §4 | `commands/authorize-field-trip.handler.ts` | `hr-administration-handlers.spec.ts`, `field-trip-cascade.service.spec.ts` |
| BR-ADP-004 AdvanceTimeout | TDD-ADP §4 | `commands/advance-field-trip-timeout.handler.ts` | `field-trip-cascade.service.spec.ts` |
| BR-ADP-004 GetFieldTrip | TDD-ADP §4 | `queries/get-field-trip.handler.ts` | — |
| BR-ADP-004 ListFieldTrips | TDD-ADP §4 | `queries/list-field-trips.handler.ts` | — |

### BR-ADP-005 — Retorno tardío

| BDD | TDD ref | Código | Prueba |
|-----|---------|--------|--------|
| BR-ADP-005 EvaluateFieldTripReturn | TDD-ADP §4 | `commands/evaluate-field-trip-return.handler.ts` | `hr-administration-handlers.spec.ts`, `field-trip-cascade.service.spec.ts` |

### BR-ADP-006 — Término laboral

| BDD | TDD ref | Código | Prueba |
|-----|---------|--------|--------|
| BR-ADP-006 TerminateEmployment | TDD-ADP §4 | `commands/terminate-employment.handler.ts` | `hr-administration-handlers.spec.ts` |

---

## Contrato OpenAPI

| Endpoint | Método | Handler | Spec contrato |
|----------|--------|---------|---------------|
| /employees | POST | CreateEmployee | `hr-administration-openapi.contract.spec.ts` |
| /employees | GET | ListEmployees | `hr-administration-openapi.contract.spec.ts` |
| /employees/:id | GET | GetEmployeeDetail | `hr-administration-openapi.contract.spec.ts` |
| /employees/:id | PATCH | UpdateEmployee | `hr-administration-openapi.contract.spec.ts` |
| /employees/:id/attendance | POST | LogAttendance | `hr-administration-openapi.contract.spec.ts` |
| /employees/:id/attendance | GET | GetEmployeeAttendance | `hr-administration-openapi.contract.spec.ts` |
| /employees/:id/attendance/summary | GET | GetAttendanceSummary | `hr-administration-openapi.contract.spec.ts` |
| /employees/:id/attendance/apply-deductions | POST | ApplyMonthDeductions | `hr-administration-openapi.contract.spec.ts` |
| /employees/:id/leaves | POST | RequestLeave | `hr-administration-openapi.contract.spec.ts` |
| /employees/:id/leaves | GET | GetEmployeeLeaves | `hr-administration-openapi.contract.spec.ts` |
| /employees/:id/leaves/:leaveId/resolve | POST | ResolveLeave | `hr-administration-openapi.contract.spec.ts` |
| /employees/:id/vacations/schedule | POST | ScheduleVacation | `hr-administration-openapi.contract.spec.ts` |
| /employees/:id/vacations | GET | GetEmployeeVacations | `hr-administration-openapi.contract.spec.ts` |
| /vacations/calendar | GET | GetVacationsCalendar | `hr-administration-openapi.contract.spec.ts` |
| /employees/:id/field-trips | POST | RequestFieldTrip | `hr-administration-openapi.contract.spec.ts` |
| /employees/:id/field-trips | GET | ListFieldTrips | `hr-administration-openapi.contract.spec.ts` |
| /employees/:id/field-trips/:tripId | GET | GetFieldTrip | `hr-administration-openapi.contract.spec.ts` |
| /employees/:id/field-trips/:tripId/authorize | POST | AuthorizeFieldTrip | `hr-administration-openapi.contract.spec.ts` |
| /employees/:id/field-trips/:tripId/evaluate-return | POST | EvaluateFieldTripReturn | `hr-administration-openapi.contract.spec.ts` |
| /employees/:id/terminate | POST | TerminateEmployment | `hr-administration-openapi.contract.spec.ts` |

---

## Migración

| Archivo | Descripción |
|---------|-------------|
| `20261008000000_add_hr_administration_module/migration.sql` | Crea tablas: employees, attendance_records, leave_requests, vacation_requests, field_trip_requests, employment_terminations |
| `20261008000001_vacation_requests_area_exclusion/migration.sql` | Agrega btree_gist + EXCLUDE constraint para BR-ADP-002 |

---

## Deuda técnica pendiente (follow-up)

| ID | Descripción | Prioridad |
|----|-------------|-----------|
| ADP-DEBT-001 | Query handlers (9) sin specs unitarios | Media — antes de release |
| ADP-DEBT-002 | MFA en terminate-employment y apply-deductions | Alta — decisión pendiente |
| ADP-DEBT-003 | area_id VARCHAR(100) vs TDD uuid — documentar decisión | Media |
| ADP-DEBT-004 | States REPROGRAMADA/CANCELADA sin endpoints | Baja — futura fase |
| ADP-DEBT-005 | employment_terminations ON DELETE CASCADE — revisar para producción | Alta |
