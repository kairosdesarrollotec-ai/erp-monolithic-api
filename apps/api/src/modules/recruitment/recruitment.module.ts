import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { AuditModule } from '../audit/audit.module';
import { OutboxModule } from '../outbox/outbox.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { RecruitmentAccessService } from './application/services/recruitment-access.service';
import { VacancyRepositoryPort } from './application/ports/vacancy-repository.port';
import { PrismaVacancyRepository } from './infrastructure/persistence/prisma-vacancy.repository';
import { CandidateRepositoryPort } from './application/ports/candidate-repository.port';
import { PrismaCandidateRepository } from './infrastructure/persistence/prisma-candidate.repository';
import { InterviewRepositoryPort } from './application/ports/interview-repository.port';
import { PrismaInterviewRepository } from './infrastructure/persistence/prisma-interview.repository';
import { OnboardingRepositoryPort } from './application/ports/onboarding-repository.port';
import { PrismaOnboardingRepository } from './infrastructure/persistence/prisma-onboarding.repository';
import { CandidateCvStoragePort } from './application/ports/candidate-cv-storage.port';
import { GcsCandidateCvService } from './infrastructure/storage/gcs-candidate-cv.service';
import { PauseVacancyHandler } from './application/commands/pause-vacancy.handler';
import { ResumeVacancyHandler } from './application/commands/resume-vacancy.handler';
import { CancelVacancyHandler } from './application/commands/cancel-vacancy.handler';
import { VacancyFromTerminationConsumer } from './application/services/vacancy-from-termination.consumer';
import { VacancyAreaCatalogPort } from './application/ports/vacancy-area-catalog.port';
import { PrismaVacancyAreaCatalogRepository } from './infrastructure/persistence/prisma-vacancy-area-catalog.repository';
import { RequestCandidateCvUploadSessionHandler } from './application/commands/request-candidate-cv-upload-session.handler';
import { RecordCandidateCvHandler } from './application/commands/record-candidate-cv.handler';
import { RecordNegotiationHandler } from './application/commands/record-negotiation.handler';
import { SetProbationFeesHandler } from './application/commands/set-probation-fees.handler';
import { GetCandidateCvHandler } from './application/queries/get-candidate-cv.handler';
import { RegisterVacancyHandler } from './application/commands/register-vacancy.handler';
import { PublishVacancyHandler } from './application/commands/publish-vacancy.handler';
import { RegisterCandidateHandler } from './application/commands/register-candidate.handler';
import { ChangeCandidateStageHandler } from './application/commands/change-candidate-stage.handler';
import { ScheduleInterviewHandler } from './application/commands/schedule-interview.handler';
import { RecordInterviewResultHandler } from './application/commands/record-interview-result.handler';
import { DecideCandidateHandler } from './application/commands/decide-candidate.handler';
import { CompleteOnboardingHandler } from './application/commands/complete-onboarding.handler';
import { EvaluateProbationHandler } from './application/commands/evaluate-probation.handler';
import { ListVacanciesHandler } from './application/queries/list-vacancies.handler';
import { GetVacancyDetailHandler } from './application/queries/get-vacancy-detail.handler';
import { ListCandidatesHandler } from './application/queries/list-candidates.handler';
import { GetCandidateDetailHandler } from './application/queries/get-candidate-detail.handler';
import { InterviewerDirectoryPort } from './application/ports/interviewer-directory.port';
import { PrismaInterviewerDirectoryRepository } from './infrastructure/persistence/prisma-interviewer-directory.repository';
import { FirebaseDisplayNameLookup } from './infrastructure/identity/firebase-display-name.lookup';
import { RecentAuthGuard } from '../users/infrastructure/auth/recent-auth.guard';
import { ListInterviewersHandler } from './application/queries/list-interviewers.handler';
import { InterviewersController } from './presentation/http/interviewers.controller';
import { VacanciesController } from './presentation/http/vacancies.controller';
import { CandidatesController } from './presentation/http/candidates.controller';
import { InterviewsController } from './presentation/http/interviews.controller';

/**
 * Módulo de Reclutamiento y Selección (REC-01 a REC-08).
 * Administra el ciclo de vida de vacantes, candidatos, entrevistas cualitativas,
 * contratación exclusiva de Gerencia/RRHH, incorporación y periodo de prueba.
 */
@Module({
  imports: [UsersModule, AuditModule, OutboxModule, AuthorizationModule],
  controllers: [VacanciesController, CandidatesController, InterviewsController, InterviewersController],
  providers: [
    RecruitmentAccessService,
    { provide: VacancyRepositoryPort, useClass: PrismaVacancyRepository },
    { provide: CandidateRepositoryPort, useClass: PrismaCandidateRepository },
    { provide: InterviewRepositoryPort, useClass: PrismaInterviewRepository },
    { provide: OnboardingRepositoryPort, useClass: PrismaOnboardingRepository },
    FirebaseDisplayNameLookup,
    RecentAuthGuard,
    { provide: InterviewerDirectoryPort, useClass: PrismaInterviewerDirectoryRepository },
    RegisterVacancyHandler,
    PublishVacancyHandler,
    PauseVacancyHandler,
    ResumeVacancyHandler,
    CancelVacancyHandler,
    VacancyFromTerminationConsumer,
    { provide: VacancyAreaCatalogPort, useClass: PrismaVacancyAreaCatalogRepository },
    RegisterCandidateHandler,
    ChangeCandidateStageHandler,
    ScheduleInterviewHandler,
    RecordInterviewResultHandler,
    DecideCandidateHandler,
    CompleteOnboardingHandler,
    EvaluateProbationHandler,
    { provide: CandidateCvStoragePort, useClass: GcsCandidateCvService },
    RequestCandidateCvUploadSessionHandler,
    RecordCandidateCvHandler,
    GetCandidateCvHandler,
    RecordNegotiationHandler,
    SetProbationFeesHandler,
    ListVacanciesHandler,
    GetVacancyDetailHandler,
    GetCandidateDetailHandler,
    ListInterviewersHandler,
    ListCandidatesHandler,
  ],
  exports: [RecruitmentAccessService, VacancyRepositoryPort, CandidateRepositoryPort],
})
export class RecruitmentModule {}
