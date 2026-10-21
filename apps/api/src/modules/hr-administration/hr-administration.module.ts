import { Module } from '@nestjs/common';
import { RecentAuthGuard } from '../users/infrastructure/auth/recent-auth.guard';
import { UsersModule } from '../users/users.module';
import { AuditModule } from '../audit/audit.module';
import { OutboxModule } from '../outbox/outbox.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { FirebaseDisplayNameLookup } from '../recruitment/infrastructure/identity/firebase-display-name.lookup';
import { HrAdministrationAccessService } from './application/services/hr-administration-access.service';
import { FieldTripCascadeService } from './application/services/field-trip-cascade.service';
import { HrMemoService } from './application/services/hr-memo.service';
import { EmployeeRepositoryPort } from './application/ports/employee-repository.port';
import { HrAreaRepositoryPort } from './application/ports/hr-area-repository.port';
import { HrAreaResolverService } from './application/services/hr-area-resolver.service';
import { PrismaHrAreaRepository } from './infrastructure/persistence/prisma-hr-area.repository';
import { CreateHrAreaHandler } from './application/commands/create-hr-area.handler';
import { SetHrAreaActiveHandler } from './application/commands/set-hr-area-active.handler';
import { ListHrAreasHandler } from './application/queries/list-hr-areas.handler';
import { HrAreasController } from './presentation/http/hr-areas.controller';
import { AttendanceRepositoryPort } from './application/ports/attendance-repository.port';
import { LeaveRepositoryPort } from './application/ports/leave-repository.port';
import { VacationRepositoryPort } from './application/ports/vacation-repository.port';
import { FieldTripRepositoryPort } from './application/ports/field-trip-repository.port';
import { EmploymentTerminationRepositoryPort } from './application/ports/employment-termination-repository.port';
import { UserDisplayNamePort } from './application/ports/user-display-name.port';
import { UserAccountEmailPort } from './application/ports/user-account-email.port';
import { HrMemoRepositoryPort } from './application/ports/hr-memo-repository.port';
import { TrainingRepositoryPort } from './application/ports/training-repository.port';
import { AttendanceEvidenceStoragePort } from './application/ports/attendance-evidence-storage.port';
import { GcsAttendanceEvidenceService } from './infrastructure/storage/gcs-attendance-evidence.service';
import { RequestAttendanceEvidenceUploadSessionHandler } from './application/commands/request-attendance-evidence-upload-session.handler';
import { LinkEmployeeAccountHandler } from './application/commands/link-employee-account.handler';
import { EmployeeAccountLinkService } from './application/services/employee-account-link.service';
import { LeaveEvidenceStoragePort } from './application/ports/leave-evidence-storage.port';
import { PrismaEmployeeRepository } from './infrastructure/persistence/prisma-employee.repository';
import { PrismaAttendanceRepository } from './infrastructure/persistence/prisma-attendance.repository';
import { PrismaLeaveRepository } from './infrastructure/persistence/prisma-leave.repository';
import { PrismaVacationRepository } from './infrastructure/persistence/prisma-vacation.repository';
import { PrismaFieldTripRepository } from './infrastructure/persistence/prisma-field-trip.repository';
import { PrismaEmploymentTerminationRepository } from './infrastructure/persistence/prisma-employment-termination.repository';
import { FirebaseUserDisplayNameAdapter } from './infrastructure/identity/firebase-user-display-name.adapter';
import { FirebaseUserAccountEmailAdapter } from './infrastructure/identity/firebase-user-account-email.adapter';
import { PrismaHrMemoRepository } from './infrastructure/persistence/prisma-hr-memo.repository';
import { PrismaTrainingRepository } from './infrastructure/persistence/prisma-training.repository';
import { GcsLeaveEvidenceService } from './infrastructure/storage/gcs-leave-evidence.service';
import { FieldTripCascadeScheduler } from './infrastructure/scheduling/field-trip-cascade.scheduler';
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
import { RejectFieldTripHandler } from './application/commands/reject-field-trip.handler';
import { ProcessDueFieldTripTimeoutsHandler } from './application/commands/process-due-field-trip-timeouts.handler';
import { ReclassifyAttendanceHandler } from './application/commands/reclassify-attendance.handler';
import { RequestLeaveEvidenceUploadSessionHandler } from './application/commands/request-leave-evidence-upload-session.handler';
import { RecordLeaveEvidenceHandler } from './application/commands/record-leave-evidence.handler';
import { RegisterTrainingHandler } from './application/commands/register-training.handler';
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
import { GetMyEmployeeHandler } from './application/queries/get-my-employee.handler';
import { GetEmployeeMemosHandler } from './application/queries/get-employee-memos.handler';
import { GetEmployeeTrainingsHandler } from './application/queries/get-employee-trainings.handler';
import { ListTrainingsHandler } from './application/queries/list-trainings.handler';
import { ListLeaveEvidenceHandler } from './application/queries/list-leave-evidence.handler';
import { EmployeesController } from './presentation/http/employees.controller';
import { AttendanceController } from './presentation/http/attendance.controller';
import { LeavesController } from './presentation/http/leaves.controller';
import { VacationsController } from './presentation/http/vacations.controller';
import { FieldTripsController } from './presentation/http/field-trips.controller';
import { MeEmployeeController } from './presentation/http/me-employee.controller';
import { TrainingsController } from './presentation/http/trainings.controller';

/**
 * Módulo de Administración de Personal (ADP-01 a ADP-10): colaboradores, asistencia y descuentos de fin de mes,
 * permisos (con evidencia adjunta), vacaciones (capacidad por área), salidas a campo (cascada de 3 niveles con avance
 * automático por vencimiento), memorandos de reincidencia, capacitación interna y término de la relación laboral.
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
    MeEmployeeController,
    TrainingsController,
    HrAreasController,
  ],
  providers: [
    HrAdministrationAccessService,
    FieldTripCascadeService,
    HrMemoService,
    FieldTripCascadeScheduler,
    RecentAuthGuard,
    FirebaseDisplayNameLookup,
    { provide: EmployeeRepositoryPort, useClass: PrismaEmployeeRepository },
    { provide: HrAreaRepositoryPort, useClass: PrismaHrAreaRepository },
    HrAreaResolverService,
    ListHrAreasHandler,
    CreateHrAreaHandler,
    SetHrAreaActiveHandler,
    { provide: AttendanceRepositoryPort, useClass: PrismaAttendanceRepository },
    { provide: LeaveRepositoryPort, useClass: PrismaLeaveRepository },
    { provide: VacationRepositoryPort, useClass: PrismaVacationRepository },
    { provide: FieldTripRepositoryPort, useClass: PrismaFieldTripRepository },
    { provide: EmploymentTerminationRepositoryPort, useClass: PrismaEmploymentTerminationRepository },
    { provide: UserDisplayNamePort, useClass: FirebaseUserDisplayNameAdapter },
    { provide: UserAccountEmailPort, useClass: FirebaseUserAccountEmailAdapter },
    { provide: HrMemoRepositoryPort, useClass: PrismaHrMemoRepository },
    { provide: TrainingRepositoryPort, useClass: PrismaTrainingRepository },
    { provide: LeaveEvidenceStoragePort, useClass: GcsLeaveEvidenceService },
    { provide: AttendanceEvidenceStoragePort, useClass: GcsAttendanceEvidenceService },
    EmployeeAccountLinkService,
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
    RejectFieldTripHandler,
    ProcessDueFieldTripTimeoutsHandler,
    ReclassifyAttendanceHandler,
    RequestLeaveEvidenceUploadSessionHandler,
    RequestAttendanceEvidenceUploadSessionHandler,
    LinkEmployeeAccountHandler,
    RecordLeaveEvidenceHandler,
    RegisterTrainingHandler,
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
    GetMyEmployeeHandler,
    GetEmployeeMemosHandler,
    GetEmployeeTrainingsHandler,
    ListTrainingsHandler,
    ListLeaveEvidenceHandler,
  ],
  exports: [HrAdministrationAccessService],
})
export class HrAdministrationModule {}
