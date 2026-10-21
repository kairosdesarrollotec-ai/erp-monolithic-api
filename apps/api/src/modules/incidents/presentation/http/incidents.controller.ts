import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
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
import { CreateIncidentHandler } from '../../application/commands/create-incident.handler';
import { CreateIncidentCommand } from '../../application/commands/create-incident.command';
import { AddIncidentActionHandler } from '../../application/commands/add-incident-action.handler';
import { AddIncidentActionCommand } from '../../application/commands/add-incident-action.command';
import { ResolveIncidentHandler } from '../../application/commands/resolve-incident.handler';
import { ResolveIncidentCommand } from '../../application/commands/resolve-incident.command';
import { CloseIncidentHandler } from '../../application/commands/close-incident.handler';
import { CloseIncidentCommand } from '../../application/commands/close-incident.command';
import { ReferIncidentToLegalHandler } from '../../application/commands/refer-incident-to-legal.handler';
import { ReferIncidentToLegalCommand } from '../../application/commands/refer-incident-to-legal.command';
import { GetIncidentHandler } from '../../application/queries/get-incident.handler';
import { GetIncidentQuery } from '../../application/queries/get-incident.query';
import { ListIncidentsHandler } from '../../application/queries/list-incidents.handler';
import { ListIncidentsQuery } from '../../application/queries/list-incidents.query';
import { INCIDENT_LIST_DEFAULT_LIMIT, INCIDENT_LIST_MAX_LIMIT } from '../../domain/incident-catalog';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { AddIncidentActionDto } from './dto/add-incident-action.dto';
import { CloseIncidentDto } from './dto/close-incident.dto';
import { ReferLegalDto } from './dto/refer-legal.dto';
import { IncidentScopeQueryDto } from './dto/incident-scope-query.dto';
import { ListIncidentsQueryDto } from './dto/list-incidents-query.dto';
import { IncidentDetailResponse, IncidentResponse } from './dto/incident.response';
import { toIncidentDetailResponse, toIncidentResponse } from './incident.mapper';

/**
 * Incidencias (INC-01 bandeja, INC-02 detalle/RIO) - contrato: packages/contracts/openapi/incidents.yaml.
 * Todos los POST aceptan `Idempotency-Key` (opcional) y los comandos sobre una incidencia exigen `If-Match: "<version>"`.
 */
@Controller('incidents')
@UseGuards(FirebaseAuthGuard)
export class IncidentsController {
  constructor(
    private readonly createIncident: CreateIncidentHandler,
    private readonly addIncidentAction: AddIncidentActionHandler,
    private readonly resolveIncident: ResolveIncidentHandler,
    private readonly closeIncident: CloseIncidentHandler,
    private readonly referIncidentToLegal: ReferIncidentToLegalHandler,
    private readonly getIncident: GetIncidentHandler,
    private readonly listIncidents: ListIncidentsHandler,
  ) {}

  @Post()
  @UseInterceptors(IdempotencyInterceptor)
  async create(@Req() req: AuthenticatedRequest, @Body() dto: CreateIncidentDto): Promise<IncidentResponse> {
    const created = await this.createIncident.execute(
      new CreateIncidentCommand(
        req.firebaseUid!,
        dto.companyId,
        dto.branchId,
        dto.rentalId,
        dto.type,
        dto.severity,
        dto.description,
        dto.returnId,
        dto.suggestion,
        dto.reportedAt ? new Date(dto.reportedAt) : undefined,
        dto.responsibleUserId,
      ),
    );
    return toIncidentResponse(created);
  }

  @Get()
  async list(@Req() req: AuthenticatedRequest, @Query() query: ListIncidentsQueryDto): Promise<IncidentResponse[]> {
    const requestedLimit = query.limit ? Number(query.limit) : undefined;
    if (requestedLimit !== undefined && requestedLimit > INCIDENT_LIST_MAX_LIMIT) {
      throw new BadRequestException(`limit no puede ser mayor a ${INCIDENT_LIST_MAX_LIMIT}.`);
    }

    let cursor: { createdAt: Date; id: string } | undefined;
    if (query.cursorCreatedAt || query.cursorId) {
      if (!query.cursorCreatedAt || !query.cursorId) {
        throw new BadRequestException('cursorCreatedAt y cursorId deben enviarse juntos para paginar.');
      }
      cursor = { createdAt: new Date(query.cursorCreatedAt), id: query.cursorId };
    }

    const results = await this.listIncidents.execute(
      new ListIncidentsQuery(
        req.firebaseUid!,
        query.companyId,
        query.branchId,
        query.type,
        query.severity,
        query.status,
        query.rentalId,
        query.returnId,
        requestedLimit ?? INCIDENT_LIST_DEFAULT_LIMIT,
        cursor,
      ),
    );
    return results.map(toIncidentResponse);
  }

  @Get(':id')
  async detail(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: IncidentScopeQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<IncidentDetailResponse> {
    const found = await this.getIncident.execute(new GetIncidentQuery(id, req.firebaseUid!, query.companyId, query.branchId));
    res.setHeader('ETag', `"${found.version}"`);
    return toIncidentDetailResponse(found);
  }

  @Post(':id/commands/add-action')
  @HttpCode(200)
  @UseInterceptors(IdempotencyInterceptor)
  async addActionCommand(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddIncidentActionDto,
    @Headers('if-match') ifMatch: string,
  ): Promise<IncidentDetailResponse> {
    const updated = await this.addIncidentAction.execute(
      new AddIncidentActionCommand(id, req.firebaseUid!, dto.companyId, dto.branchId, parseVersionIfMatch(ifMatch), dto.description),
    );
    return toIncidentDetailResponse(updated);
  }

  @Post(':id/commands/resolve')
  @HttpCode(200)
  @UseInterceptors(IdempotencyInterceptor)
  async resolveCommand(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CloseIncidentDto,
    @Headers('if-match') ifMatch: string,
  ): Promise<IncidentDetailResponse> {
    const updated = await this.resolveIncident.execute(
      new ResolveIncidentCommand(id, req.firebaseUid!, dto.companyId, dto.branchId, parseVersionIfMatch(ifMatch), dto.resolutionSummary),
    );
    return toIncidentDetailResponse(updated);
  }

  @Post(':id/commands/close')
  @HttpCode(200)
  @UseInterceptors(IdempotencyInterceptor)
  async closeCommand(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CloseIncidentDto,
    @Headers('if-match') ifMatch: string,
  ): Promise<IncidentDetailResponse> {
    const updated = await this.closeIncident.execute(
      new CloseIncidentCommand(id, req.firebaseUid!, dto.companyId, dto.branchId, parseVersionIfMatch(ifMatch), dto.resolutionSummary, dto.decision),
    );
    return toIncidentDetailResponse(updated);
  }

  @Post(':id/commands/refer-legal')
  @HttpCode(200)
  @UseInterceptors(IdempotencyInterceptor)
  async referLegalCommand(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReferLegalDto,
    @Headers('if-match') ifMatch: string,
  ): Promise<IncidentDetailResponse> {
    const updated = await this.referIncidentToLegal.execute(
      new ReferIncidentToLegalCommand(id, req.firebaseUid!, dto.companyId, dto.branchId, parseVersionIfMatch(ifMatch), dto.reason, dto.decision),
    );
    return toIncidentDetailResponse(updated);
  }
}
