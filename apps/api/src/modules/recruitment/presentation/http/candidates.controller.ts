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
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthenticatedRequest, FirebaseAuthGuard } from '../../../users/infrastructure/auth/firebase-auth.guard';
import { parseVersionIfMatch } from '../../../../common/http/etag';
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
  CandidateDetailResponse,
  CandidateInterviewResponse,
  CandidateResponse,
  OnboardingResponse,
} from './dto/recruitment.response';
import {
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
}
