import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AuthenticatedRequest, FirebaseAuthGuard } from '../../../users/infrastructure/auth/firebase-auth.guard';
import { ListHrAreasHandler } from '../../application/queries/list-hr-areas.handler';
import { ListHrAreasQuery } from '../../application/queries/list-hr-areas.query';
import { ListHrAreasQueryDto } from './dto/list-hr-areas-query.dto';
import type { HrAreaListResponse } from './dto/hr-administration.response';

/** H-02: catalogo de areas de RR.HH. (lectura). */
@Controller('hr-areas')
@UseGuards(FirebaseAuthGuard)
export class HrAreasController {
  constructor(private readonly listHrAreas: ListHrAreasHandler) {}

  @Get()
  async list(@Req() req: AuthenticatedRequest, @Query() query: ListHrAreasQueryDto): Promise<HrAreaListResponse> {
    const items = await this.listHrAreas.execute(new ListHrAreasQuery(req.firebaseUid!, query.companyId, query.branchId));
    return {
      items: items.map((a) => ({ code: a.code, name: a.name, description: a.description, sortOrder: a.sortOrder })),
    };
  }
}
