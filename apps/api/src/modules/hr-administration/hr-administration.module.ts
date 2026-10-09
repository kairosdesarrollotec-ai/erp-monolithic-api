import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { AuditModule } from '../audit/audit.module';
import { OutboxModule } from '../outbox/outbox.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { FirebaseDisplayNameLookup } from '../recruitment/infrastructure/identity/firebase-display-name.lookup';
import { HrAdministrationAccessService } from './application/services/hr-administration-access.service';
import { FieldTripCascadeService } from './application/services/field-trip-cascade.service';
import { EmployeeRepositoryPort } from './application/ports/employee-repository.port';
import { AttendanceRepositoryPort } from './application/ports/attendance-repository.port';
import { LeaveRepositoryPort } from './application/ports/leave-repository.port';
import { VacationRepositoryPort } from './application/ports/vacation-repository.port';
import { FieldTripRepositoryPort } from './application/ports/field-trip-repository.port';
import { EmploymentTerminationRepositoryPort } from './application/ports/employment-termination-repository.port';
import { UserDisplayNamePort } from './application/ports/user-display-name.port';
import { PrismaEmployeeRepository } from './infrastructure/persistence/prisma-employee.repository';
import { PrismaAttendanceRepository } from './infrastructure/persistence/prisma-attendance.repository';
import { PrismaLeaveRepository } from './infrastructure/persistence/prisma-leave.repository';
import { PrismaVacationRepository } from './infrastructure/persistence/prisma-vacation.repository';
import { PrismaFieldTripRepository } from './infrastructure/persistence/prisma-field-trip.repository';
import { PrismaEmploymentTerminationRepository } from './infrastructure/persistence/prisma-employment-termination.repository';
import { FirebaseUserDisplayNameAdapter } from './infrastructure/identity/firebase-user-display-name.adapter';
import { CreateEmployeeHandler } from './application/commands/create-employee.handler';
import { UpdateEmployeeHandler } from './application/commands/update-employee.handler';
import { LogAttendanceHandler } from './application/commands/log-attendance.handler';
import { ApplyMonthDeductionsHandler } from './application/commands/apply-month-deductions.handler';
import { RequestLeaveHandler } from './application/commands/request-leave.handler';
import { ResolveLeaveHandler } from './application/commands/resolve-leave.handler';
import { ScheduleVacationHandler } from './application/commands/schedule-vacation.handler';
import { RequestFieldTripHandler } from './application/commands/request-field-trip.handler';
import { AuthorizeFieldTripHandler } from './application/commands/authorize-field-trip.handler';
import { AdvanceFieldTripTimeoutHandler } from './application/commands/advance-field-trip-timeout.handler';
import { EvaluateFieldTripReturnHandler } from './application/commands/evaluate-field-trip-return.handler';
import { TerminateEmploymentHandler } from './application/commands/terminate-employment.handler';
import { ListEmployeesHandler } from './application/queries/list-employees.handler';
import { GetEmployeeDetailHandler } from './application/queries/get-employee-detail.handler';
import { GetEmployeeAttendanceHandler } from './application/queries/get-employee-attendance.handler';
import { GetAttendanceSummaryHandler } from './application/queries/get-attendance-summary.handler';
import { GetEmployeeLeavesHandler } from './application/queries/get-employee-leaves.handler';
import { GetEmployeeVacationsHandler } from './application/queries/get-employee-vacations.handler';
import { GetVacationsCalendarHandler } from './application/queries/get-vacations-calendar.handler';
import { ListFieldTripsHandler } from './application/queries/list-field-trips.handler';
import { GetFieldTripHandler } from './application/queries/get-field-trip.handler';
import { EmployeesController } from './presentation/http/employees.controller';
import { AttendanceController } from './presentation/http/attendance.controller';
import { LeavesController } from './presentation/http/leaves.controller';
import { VacationsController } from './presentation/http/vacations.controller';
import { FieldTripsController } from './presentation/http/field-trips.controller';

/**
 * Módulo de Administración de Personal (ADP-01 a ADP-10): colaboradores, asistencia y descuentos de fin de mes,
 * permisos, vacaciones (capacidad por área), salidas a campo (cascada de 3 niveles) y término de la relación laboral.
 * Su único acoplamiento con Reclutamiento es el evento RelacionLaboralTerminada.v1 por outbox (ADR-KAI-006).
 */
@Module({
  imports: [UsersModule, AuditModule, OutboxModule, AuthorizationModule],
  controllers: [
    EmployeesController,
    AttendanceController,
    LeavesController,
    VacationsController,
    FieldTripsController,
  ],
  providers: [
    HrAdministrationAccessService,
    FieldTripCascadeService,
    FirebaseDisplayNameLookup,
    { provide: EmployeeRepositoryPort, useClass: PrismaEmployeeRepository },
    { provide: AttendanceRepositoryPort, useClass: PrismaAttendanceRepository },
    { provide: LeaveRepositoryPort, useClass: PrismaLeaveRepository },
    { provide: VacationRepositoryPort, useClass: PrismaVacationRepository },
    { provide: FieldTripRepositoryPort, useClass: PrismaFieldTripRepository },
    { provide: EmploymentTerminationRepositoryPort, useClass: PrismaEmploymentTerminationRepository },
    { provide: UserDisplayNamePort, useClass: FirebaseUserDisplayNameAdapter },
    CreateEmployeeHandler,
    UpdateEmployeeHandler,
    LogAttendanceHandler,
    ApplyMonthDeductionsHandler,
    RequestLeaveHandler,
    ResolveLeaveHandler,
    ScheduleVacationHandler,
    RequestFieldTripHandler,
    AuthorizeFieldTripHandler,
    AdvanceFieldTripTimeoutHandler,
    EvaluateFieldTripReturnHandler,
    TerminateEmploymentHandler,
    ListEmployeesHandler,
    GetEmployeeDetailHandler,
    GetEmployeeAttendanceHandler,
    GetAttendanceSummaryHandler,
    GetEmployeeLeavesHandler,
    GetEmployeeVacationsHandler,
    GetVacationsCalendarHandler,
    ListFieldTripsHandler,
    GetFieldTripHandler,
  ],
  exports: [HrAdministrationAccessService],
})
export class HrAdministrationModule {}
