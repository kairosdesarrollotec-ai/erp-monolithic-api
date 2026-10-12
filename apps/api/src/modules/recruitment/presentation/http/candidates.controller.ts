import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthenticatedRequest, FirebaseAuthGuard } from '../../../users/infrastructure/auth/firebase-auth.guard';
import { parseVersionIfMatch } from '../../../../common/http/etag';
import { IdempotencyInterceptor } from '../../../../common/http/idempotency.interceptor';
import { RequestCandidateCvUploadSessionHandler } from '../../application/commands/request-candidate-cv-upload-session.handler';
import { RequestCandidateCvUploadSessionCommand } from '../../application/commands/request-candidate-cv-upload-session.command';
import { RecordCandidateCvHandler } from '../../application/commands/record-candidate-cv.handler';
import { RecordCandidateCvCommand } from '../../application/commands/record-candidate-cv.command';
import { RecordNegotiationHandler } from '../../application/commands/record-negotiation.handler';
import { RecordNegotiationCommand } from '../../application/commands/record-negotiation.command';
import { SetProbationFeesHandler } from '../../application/commands/set-probation-fees.handler';
import { SetProbationFeesCommand } from '../../application/commands/set-probation-fees.command';
import { GetCandidateCvHandler } from '../../application/queries/get-candidate-cv.handler';
import { GetCandidateCvQuery } from '../../application/queries/get-candidate-cv.query';
import { RequestCandidateCvUploadSessionDto } from './dto/request-candidate-cv-upload-session.dto';
import { RecordCandidateCvDto } from './dto/record-candidate-cv.dto';
import { RecordNegotiationDto } from './dto/record-negotiation.dto';
import { SetProbationFeesDto } from './dto/set-probation-fees.dto';
import { ChangeCandidateStageHandler } from '../../application/commands/change-candidate-stage.handler';
import { ChangeCandidateStageCommand } from '../../application/commands/change-candidate-stage.command';
import { ScheduleInterviewHandler } from '../../application/commands/schedule-interview.handler';
import { ScheduleInterviewCommand } from '../../application/commands/schedule-interview.command';
import { DecideCandidateHandler } from '../../application/commands/decide-candidate.handler';
import { DecideCandidateCommand } from '../../application/commands/decide-candidate.command';
import { CompleteOnboardingHandler } from '../../application/commands/complete-onboarding.handler';
import { CompleteOnboardingCommand } from '../../application/commands/complete-onboarding.command';
import { EvaluateProbationHandler } from '../../application/commands/evaluate-probation.handler';
import { EvaluateProbationCommand } from '../../application/commands/evaluate-probation.command';
import { GetCandidateDetailHandler } from '../../application/queries/get-candidate-detail.handler';
import { GetCandidateDetailQuery } from '../../application/queries/get-candidate-detail.query';
import { VacancyScopeQueryDto } from './dto/vacancy-scope-query.dto';
import { ChangeCandidateStageDto } from './dto/change-candidate-stage.dto';
import { ScheduleInterviewDto } from './dto/schedule-interview.dto';
import { DecideCandidateDto } from './dto/decide-candidate.dto';
import { CompleteOnboardingDto } from './dto/complete-onboarding.dto';
import { EvaluateProbationDto } from './dto/evaluate-probation.dto';
import {
  CandidateCvUploadSessionResponse,
  CandidateCvViewResponse,
  CandidateDetailResponse,
  CandidateInterviewResponse,
  CandidateResponse,
  OnboardingResponse,
} from './dto/recruitment.response';
import {
  toCandidateCvUploadSessionResponse,
  toCandidateCvViewResponse,
  toCandidateDetailResponse,
  toCandidateInterviewResponse,
  toCandidateResponse,
  toOnboardingResponse,
} from './recruitment.mapper';

@Controller('candidates')
@UseGuards(FirebaseAuthGuard)
export class CandidatesController {
  constructor(
    private readonly getCandidateDetail: GetCandidateDetailHandler,
    private readonly changeStage: ChangeCandidateStageHandler,
    private readonly scheduleInterview: ScheduleInterviewHandler,
    private readonly decideCandidate: DecideCandidateHandler,
    private readonly completeOnboarding: CompleteOnboardingHandler,
    private readonly evaluateProbation: EvaluateProbationHandler,
    private readonly requestCvUploadSession: RequestCandidateCvUploadSessionHandler,
    private readonly recordCv: RecordCandidateCvHandler,
    private readonly getCv: GetCandidateCvHandler,
    private readonly recordNegotiation: RecordNegotiationHandler,
    private readonly setProbationFees: SetProbationFeesHandler,
  ) {}

  @Get(':id')
  async getDetail(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: VacancyScopeQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<CandidateDetailResponse> {
    const detail = await this.getCandidateDetail.execute(
      new GetCandidateDetailQuery(req.firebaseUid!, id, query.companyId, query.branchId),
    );
    res.setHeader('ETag', `"${detail.version}"`);
    return toCandidateDetailResponse(detail);
  }

  @Post(':id/commands/change-stage')
  @HttpCode(HttpStatus.OK)
  async changeCandidateStage(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() dto: ChangeCandidateStageDto,
  ): Promise<CandidateResponse> {
    const expectedVersion = parseVersionIfMatch(ifMatch);
    const updated = await this.changeStage.execute(
      new ChangeCandidateStageCommand(
        req.firebaseUid!,
        id,
        dto.companyId,
        dto.branchId,
        dto.stage,
        expectedVersion,
      ),
    );
    return toCandidateResponse(updated);
  }

  @Post(':id/interviews')
  @HttpCode(HttpStatus.CREATED)
  async addInterview(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ScheduleInterviewDto,
  ): Promise<CandidateInterviewResponse> {
    const interview = await this.scheduleInterview.execute(
      new ScheduleInterviewCommand(
        req.firebaseUid!,
        id,
        dto.companyId,
        dto.branchId,
        new Date(dto.scheduledAt),
        dto.isVirtual,
        dto.interviewerId,
        dto.meetUrl,
        dto.location,
      ),
    );
    return toCandidateInterviewResponse(interview);
  }

  @Post(':id/commands/decide')
  @HttpCode(HttpStatus.OK)
  async decide(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() dto: DecideCandidateDto,
  ): Promise<CandidateDetailResponse> {
    const expectedVersion = parseVersionIfMatch(ifMatch);
    const decided = await this.decideCandidate.execute(
      new DecideCandidateCommand(
        req.firebaseUid!,
        id,
        dto.companyId,
        dto.branchId,
        dto.decision,
        expectedVersion,
        dto.decisionNotes,
      ),
    );
    return toCandidateDetailResponse(decided);
  }

  @Post(':id/commands/complete-onboarding')
  @HttpCode(HttpStatus.OK)
  async complete(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CompleteOnboardingDto,
  ): Promise<OnboardingResponse> {
    const onboarding = await this.completeOnboarding.execute(
      new CompleteOnboardingCommand(
        req.firebaseUid!,
        id,
        dto.companyId,
        dto.branchId,
        new Date(dto.startDate),
        dto.inductionScheduled,
        dto.equipmentAssigned,
        dto.responsibilityCardSigned,
        dto.notarizedContractSigned ?? false,
      ),
    );
    return toOnboardingResponse(onboarding);
  }

  @Post(':id/commands/evaluate-probation')
  @HttpCode(HttpStatus.OK)
  async evaluate(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EvaluateProbationDto,
  ): Promise<OnboardingResponse> {
    const evaluated = await this.evaluateProbation.execute(
      new EvaluateProbationCommand(
        req.firebaseUid!,
        id,
        dto.companyId,
        dto.branchId,
        dto.passed,
        dto.qualitativeEvaluation,
      ),
    );
    return toOnboardingResponse(evaluated);
  }

  // --- CV (DAT-REC-004) -----------------------------------------------------

  @Post(':id/cv/upload-session')
  @HttpCode(HttpStatus.CREATED)
  async requestCvUpload(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RequestCandidateCvUploadSessionDto,
  ): Promise<CandidateCvUploadSessionResponse> {
    const session = await this.requestCvUploadSession.execute(
      new RequestCandidateCvUploadSessionCommand(
        req.firebaseUid!,
        id,
        dto.companyId,
        dto.branchId,
        dto.contentType,
        dto.contentLength,
      ),
    );
    return toCandidateCvUploadSessionResponse(session);
  }

  @Post(':id/commands/record-cv')
  @HttpCode(HttpStatus.OK)
  async recordCandidateCv(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() dto: RecordCandidateCvDto,
  ): Promise<CandidateDetailResponse> {
    const expectedVersion = parseVersionIfMatch(ifMatch);
    const detail = await this.recordCv.execute(
      new RecordCandidateCvCommand(
        req.firebaseUid!,
        id,
        dto.companyId,
        dto.branchId,
        dto.objectUrl,
        dto.fileName,
        expectedVersion,
      ),
    );
    return toCandidateDetailResponse(detail);
  }

  @Get(':id/cv')
  async viewCv(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: VacancyScopeQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<CandidateCvViewResponse> {
    const view = await this.getCv.execute(new GetCandidateCvQuery(req.firebaseUid!, id, query.companyId, query.branchId));
    // La URL firmada es una credencial temporal: nunca debe quedar en caches intermedios.
    res.setHeader('Cache-Control', 'no-store');
    return toCandidateCvViewResponse(view);
  }

  // --- Negociacion de condiciones (REC-04) ---------------------------------

  @Post(':id/negotiations')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(IdempotencyInterceptor)
  async addNegotiation(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() dto: RecordNegotiationDto,
  ): Promise<CandidateDetailResponse> {
    const expectedVersion = parseVersionIfMatch(ifMatch);
    const detail = await this.recordNegotiation.execute(
      new RecordNegotiationCommand(
        req.firebaseUid!,
        id,
        dto.companyId,
        dto.branchId,
        expectedVersion,
        dto.outcome,
        dto.offeredSalary,
        dto.offeredSchedule,
        dto.offeredOtherConditions,
        dto.candidateSalary,
        dto.candidateSchedule,
        dto.candidateOtherConditions,
        dto.candidateStartDate ? new Date(dto.candidateStartDate) : undefined,
        dto.agreedSalary,
        dto.agreedConditions,
        dto.reason,
      ),
    );
    return toCandidateDetailResponse(detail);
  }

  // --- Honorarios del periodo de prueba (REC-08) ----------------------------

  @Post(':id/commands/set-probation-fees')
  @HttpCode(HttpStatus.OK)
  async setFees(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() dto: SetProbationFeesDto,
  ): Promise<OnboardingResponse> {
    const expectedVersion = parseVersionIfMatch(ifMatch);
    const onboarding = await this.setProbationFees.execute(
      new SetProbationFeesCommand(
        req.firebaseUid!,
        id,
        dto.companyId,
        dto.branchId,
        expectedVersion,
        dto.probationMonthlyFee,
        dto.postProbationMonthlySalary,
        dto.probationFeeNotes,
      ),
    );
    return toOnboardingResponse(onboarding);
  }
}
