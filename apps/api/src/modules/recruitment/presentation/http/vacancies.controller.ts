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
import { RegisterVacancyHandler } from '../../application/commands/register-vacancy.handler';
import { RegisterVacancyCommand } from '../../application/commands/register-vacancy.command';
import { PublishVacancyHandler } from '../../application/commands/publish-vacancy.handler';
import { PublishVacancyCommand } from '../../application/commands/publish-vacancy.command';
import { PauseVacancyHandler } from '../../application/commands/pause-vacancy.handler';
import { PauseVacancyCommand } from '../../application/commands/pause-vacancy.command';
import { ResumeVacancyHandler } from '../../application/commands/resume-vacancy.handler';
import { ResumeVacancyCommand } from '../../application/commands/resume-vacancy.command';
import { CancelVacancyHandler } from '../../application/commands/cancel-vacancy.handler';
import { CancelVacancyCommand } from '../../application/commands/cancel-vacancy.command';
import { CancelVacancyDto } from './dto/cancel-vacancy.dto';
import { PauseVacancyDto } from './dto/pause-vacancy.dto';
import { ResumeVacancyDto } from './dto/resume-vacancy.dto';
import { RegisterCandidateHandler } from '../../application/commands/register-candidate.handler';
import { RegisterCandidateCommand } from '../../application/commands/register-candidate.command';
import { ListVacanciesHandler } from '../../application/queries/list-vacancies.handler';
import { ListVacanciesQuery } from '../../application/queries/list-vacancies.query';
import { ListCandidatesHandler } from '../../application/queries/list-candidates.handler';
import { ListCandidatesQuery } from '../../application/queries/list-candidates.query';
import { GetVacancyDetailHandler } from '../../application/queries/get-vacancy-detail.handler';
import { GetVacancyDetailQuery } from '../../application/queries/get-vacancy-detail.query';
import { RegisterVacancyDto } from './dto/register-vacancy.dto';
import { PublishVacancyDto } from './dto/publish-vacancy.dto';
import { ListVacanciesQueryDto } from './dto/list-vacancies-query.dto';
import { VacancyScopeQueryDto } from './dto/vacancy-scope-query.dto';
import { ListCandidatesQueryDto } from './dto/list-candidates-query.dto';
import { RegisterCandidateDto } from './dto/register-candidate.dto';
import {
  CandidateResponse,
  VacancyDetailResponse,
  VacancyResponse,
} from './dto/recruitment.response';
import {
  toCandidateResponse,
  toVacancyDetailResponse,
  toVacancyResponse,
} from './recruitment.mapper';

@Controller('vacancies')
@UseGuards(FirebaseAuthGuard)
export class VacanciesController {
  constructor(
    private readonly registerVacancy: RegisterVacancyHandler,
    private readonly publishVacancy: PublishVacancyHandler,
    private readonly pauseVacancy: PauseVacancyHandler,
    private readonly resumeVacancy: ResumeVacancyHandler,
    private readonly cancelVacancy: CancelVacancyHandler,
    private readonly listVacancies: ListVacanciesHandler,
    private readonly getVacancyDetail: GetVacancyDetailHandler,
    private readonly registerCandidate: RegisterCandidateHandler,
    private readonly listCandidates: ListCandidatesHandler,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(IdempotencyInterceptor)
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: RegisterVacancyDto,
  ): Promise<VacancyResponse> {
    const created = await this.registerVacancy.execute(
      new RegisterVacancyCommand(
        req.firebaseUid!,
        dto.companyId,
        dto.branchId,
        dto.title,
        dto.department,
        dto.source,
        dto.isMechanic,
      ),
    );
    return toVacancyResponse(created);
  }

  @Get()
  async list(
    @Req() req: AuthenticatedRequest,
    @Query() query: ListVacanciesQueryDto,
  ): Promise<VacancyResponse[]> {
    const items = await this.listVacancies.execute(
      new ListVacanciesQuery(
        req.firebaseUid!,
        query.companyId,
        query.branchId,
        query.status,
        query.limit,
        query.cursorCreatedAt ? new Date(query.cursorCreatedAt) : undefined,
        query.cursorId,
      ),
    );
    return items.map((i) => toVacancyResponse(i));
  }

  @Get(':id')
  async getDetail(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: VacancyScopeQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<VacancyDetailResponse> {
    const detail = await this.getVacancyDetail.execute(
      new GetVacancyDetailQuery(req.firebaseUid!, id, query.companyId, query.branchId),
    );
    res.setHeader('ETag', `"${detail.version}"`);
    return toVacancyDetailResponse(detail);
  }

  @Get(':id/candidates')
  async listVacancyCandidates(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListCandidatesQueryDto,
  ): Promise<CandidateResponse[]> {
    const items = await this.listCandidates.execute(
      new ListCandidatesQuery(req.firebaseUid!, id, query.companyId, query.branchId, query.stage),
    );
    return items.map((c) => toCandidateResponse(c));
  }

  @Post(':id/commands/publish')
  @HttpCode(HttpStatus.OK)
  async publish(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() dto: PublishVacancyDto,
  ): Promise<VacancyDetailResponse> {
    const expectedVersion = parseVersionIfMatch(ifMatch);
    const published = await this.publishVacancy.execute(
      new PublishVacancyCommand(
        req.firebaseUid!,
        id,
        dto.companyId,
        dto.branchId,
        dto.profileDescription,
        dto.baseSalary,
        dto.scheduleDetails,
        dto.channels,
        expectedVersion,
      ),
    );
    return toVacancyDetailResponse(published);
  }

  @Post(':id/commands/pause')
  @HttpCode(HttpStatus.OK)
  async pause(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() dto: PauseVacancyDto,
  ): Promise<VacancyDetailResponse> {
    const expectedVersion = parseVersionIfMatch(ifMatch);
    const paused = await this.pauseVacancy.execute(
      new PauseVacancyCommand(req.firebaseUid!, id, dto.companyId, dto.branchId, expectedVersion, dto.reason),
    );
    return toVacancyDetailResponse(paused);
  }

  @Post(':id/commands/resume')
  @HttpCode(HttpStatus.OK)
  async resume(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() dto: ResumeVacancyDto,
  ): Promise<VacancyDetailResponse> {
    const expectedVersion = parseVersionIfMatch(ifMatch);
    const resumed = await this.resumeVacancy.execute(
      new ResumeVacancyCommand(req.firebaseUid!, id, dto.companyId, dto.branchId, expectedVersion),
    );
    return toVacancyDetailResponse(resumed);
  }

  @Post(':id/commands/cancel')
  @HttpCode(HttpStatus.OK)
  async cancel(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() dto: CancelVacancyDto,
  ): Promise<VacancyDetailResponse> {
    const expectedVersion = parseVersionIfMatch(ifMatch);
    const cancelled = await this.cancelVacancy.execute(
      new CancelVacancyCommand(req.firebaseUid!, id, dto.companyId, dto.branchId, expectedVersion, dto.reason),
    );
    return toVacancyDetailResponse(cancelled);
  }

  @Post(':id/candidates')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(IdempotencyInterceptor)
  async addCandidate(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RegisterCandidateDto,
  ): Promise<CandidateResponse> {
    const candidate = await this.registerCandidate.execute(
      new RegisterCandidateCommand(
        req.firebaseUid!,
        id,
        dto.companyId,
        dto.branchId,
        dto.fullName,
        dto.documentType ?? 'DNI',
        dto.documentNumber,
        dto.cvDocumentId,
        dto.email,
        dto.phone,
        dto.salaryExpectation,
      ),
    );
    return toCandidateResponse(candidate);
  }
}
