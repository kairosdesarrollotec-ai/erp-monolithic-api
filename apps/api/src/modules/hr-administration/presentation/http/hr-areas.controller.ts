import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { IdempotencyInterceptor } from '../../../../common/http/idempotency.interceptor';
import { AuthenticatedRequest, FirebaseAuthGuard } from '../../../users/infrastructure/auth/firebase-auth.guard';
import { CreateHrAreaCommand } from '../../application/commands/create-hr-area.command';
import { CreateHrAreaHandler } from '../../application/commands/create-hr-area.handler';
import { SetHrAreaActiveCommand } from '../../application/commands/set-hr-area-active.command';
import { SetHrAreaActiveHandler } from '../../application/commands/set-hr-area-active.handler';
import { ListHrAreasHandler } from '../../application/queries/list-hr-areas.handler';
import { ListHrAreasQuery } from '../../application/queries/list-hr-areas.query';
import type { HrAreaAdminView } from '../../application/ports/hr-area-repository.port';
import { CreateHrAreaDto } from './dto/create-hr-area.dto';
import { ListHrAreasQueryDto } from './dto/list-hr-areas-query.dto';
import { HrAreaContextDto } from './dto/set-hr-area-active.dto';
import type { HrAreaListResponse, HrAreaResponse } from './dto/hr-administration.response';

function toResponse(a: HrAreaAdminView): HrAreaResponse {
  return { code: a.code, name: a.name, description: a.description, sortOrder: a.sortOrder, isActive: a.isActive };
}

/** H-02: catalogo de areas de RR.HH. Lectura para personal; alta/desactivacion solo Gerencia General (MANAGE_AREAS). */
@Controller('hr-areas')
@UseGuards(FirebaseAuthGuard)
export class HrAreasController {
  constructor(
    private readonly listHrAreas: ListHrAreasHandler,
    private readonly createHrArea: CreateHrAreaHandler,
    private readonly setHrAreaActive: SetHrAreaActiveHandler,
  ) {}

  @Get()
  async list(@Req() req: AuthenticatedRequest, @Query() query: ListHrAreasQueryDto): Promise<HrAreaListResponse> {
    const items = await this.listHrAreas.execute(
      new ListHrAreasQuery(req.firebaseUid!, query.companyId, query.branchId, query.includeInactive === true || String(query.includeInactive) === 'true'),
    );
    return { items: items.map(toResponse) };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(IdempotencyInterceptor)
  async create(@Req() req: AuthenticatedRequest, @Body() dto: CreateHrAreaDto): Promise<HrAreaResponse> {
    const created = await this.createHrArea.execute(
      new CreateHrAreaCommand(req.firebaseUid!, dto.companyId, dto.branchId, dto.name, dto.description),
    );
    return toResponse(created);
  }

  @Post(':code/deactivate')
  @HttpCode(HttpStatus.OK)
  async deactivate(@Req() req: AuthenticatedRequest, @Param('code') code: string, @Body() dto: HrAreaContextDto): Promise<HrAreaResponse> {
    return toResponse(await this.setHrAreaActive.execute(new SetHrAreaActiveCommand(req.firebaseUid!, dto.companyId, dto.branchId, code, false)));
  }

  @Post(':code/reactivate')
  @HttpCode(HttpStatus.OK)
  async reactivate(@Req() req: AuthenticatedRequest, @Param('code') code: string, @Body() dto: HrAreaContextDto): Promise<HrAreaResponse> {
    return toResponse(await this.setHrAreaActive.execute(new SetHrAreaActiveCommand(req.firebaseUid!, dto.companyId, dto.branchId, code, true)));
  }
}
