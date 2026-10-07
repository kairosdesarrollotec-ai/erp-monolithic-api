import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { GetMyPermissionsHandler } from '../../application/queries/get-my-permissions.handler';
import { GetMyPermissionsQuery } from '../../application/queries/get-my-permissions.query';
import { AuthenticatedRequest, FirebaseAuthGuard } from '../../../users/infrastructure/auth/firebase-auth.guard';
import { GetMyPermissionsQueryDto } from './dto/get-my-permissions-query.dto';
import { EffectivePermissionsResponse } from './dto/my-permissions.response';

/**
 * GET /me/permissions (contrato admin.yaml 0.2.0): permisos efectivos del
 * usuario autenticado en su contexto de trabajo. No exige ninguna accion de
 * Administracion: solo una asignacion vigente en esa empresa/sede.
 */
@Controller('me')
@UseGuards(FirebaseAuthGuard)
export class MePermissionsController {
  constructor(private readonly getMyPermissions: GetMyPermissionsHandler) {}

  @Get('permissions')
  async permissions(
    @Req() req: AuthenticatedRequest,
    @Query() query: GetMyPermissionsQueryDto,
  ): Promise<EffectivePermissionsResponse> {
    return this.getMyPermissions.execute(new GetMyPermissionsQuery(req.firebaseUid!, query.companyId, query.branchId));
  }
}
