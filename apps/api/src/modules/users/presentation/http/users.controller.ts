import { Body, Controller, Get, HttpCode, Post, Query, Req, UseGuards } from '@nestjs/common';
import { GetActivationStatusHandler } from '../../application/queries/get-activation-status.handler';
import { GetActivationStatusQuery } from '../../application/queries/get-activation-status.query';
import { CompleteActivationHandler } from '../../application/commands/complete-activation.handler';
import { CompleteActivationCommand } from '../../application/commands/complete-activation.command';
import { GetWorkContextAssignmentsHandler } from '../../application/queries/get-work-context-assignments.handler';
import { GetWorkContextAssignmentsQuery } from '../../application/queries/get-work-context-assignments.query';
import { SelectWorkContextHandler } from '../../application/commands/select-work-context.handler';
import { SelectWorkContextCommand } from '../../application/commands/select-work-context.command';
import { GetDashboardHandler } from '../../application/queries/get-dashboard.handler';
import { GetDashboardQuery } from '../../application/queries/get-dashboard.query';
import { GetMyProfileHandler } from '../../application/queries/get-my-profile.handler';
import { GetMyProfileQuery } from '../../application/queries/get-my-profile.query';
import {
  AuthenticatedRequest,
  FirebaseAuthGuard,
} from '../../infrastructure/auth/firebase-auth.guard';
import { ActivationStatusResponse } from './dto/activation-status.response';
import { WorkContextAssignmentsResponse } from './dto/work-context-assignments.response';
import { SelectWorkContextDto } from './dto/select-work-context.dto';
import { DashboardResponse } from './dto/dashboard.response';
import { GetDashboardDto } from './dto/get-dashboard.dto';
import { UserProfileResponse } from './dto/user-profile.response';

@Controller('users/me')
@UseGuards(FirebaseAuthGuard)
export class UsersController {
  constructor(
    private readonly getActivationStatus: GetActivationStatusHandler,
    private readonly completeActivation: CompleteActivationHandler,
    private readonly getWorkContextAssignments: GetWorkContextAssignmentsHandler,
    private readonly selectWorkContext: SelectWorkContextHandler,
    private readonly getDashboard: GetDashboardHandler,
    private readonly getMyProfile: GetMyProfileHandler,
  ) {}

  @Get('activation-status')
  async activationStatus(@Req() req: AuthenticatedRequest): Promise<ActivationStatusResponse> {
    return this.getActivationStatus.execute(new GetActivationStatusQuery(req.firebaseUid!));
  }

  /** TR-09 - perfil consolidado del usuario autenticado. */
  @Get('profile')
  async profile(@Req() req: AuthenticatedRequest): Promise<UserProfileResponse> {
    return this.getMyProfile.execute(
      new GetMyProfileQuery(req.firebaseUid!, req.email, req.displayName),
    );
  }

  @Post('complete-activation')
  @HttpCode(204)
  async completeActivationEndpoint(@Req() req: AuthenticatedRequest): Promise<void> {
    await this.completeActivation.execute(new CompleteActivationCommand(req.firebaseUid!));
  }

  /** TR-05 (HU-23) - lista de empresas/sedes autorizadas para el usuario. */
  @Get('assignments')
  async assignments(@Req() req: AuthenticatedRequest): Promise<WorkContextAssignmentsResponse> {
    const assignments = await this.getWorkContextAssignments.execute(
      new GetWorkContextAssignmentsQuery(req.firebaseUid!),
    );
    return { assignments };
  }

  /** TR-05 (HU-23) - fija el contexto de trabajo elegido, con validacion server-side. */
  @Post('work-context')
  @HttpCode(204)
  async workContext(
    @Req() req: AuthenticatedRequest,
    @Body() dto: SelectWorkContextDto,
  ): Promise<void> {
    await this.selectWorkContext.execute(
      new SelectWorkContextCommand(req.firebaseUid!, dto.companyId, dto.branchId),
    );
  }

  /** TR-06 (HU-24) - resuelve el rol del usuario para el contexto de
   * trabajo elegido y enruta al tablero correspondiente. PROVISIONAL:
   * siempre EMPTY hasta que existan modulos de dominio con datos reales
   * (ver nota en GetDashboardHandler). */
  @Get('dashboard')
  async dashboard(
    @Req() req: AuthenticatedRequest,
    @Query() query: GetDashboardDto,
  ): Promise<DashboardResponse> {
    return this.getDashboard.execute(
      new GetDashboardQuery(req.firebaseUid!, query.companyId, query.branchId),
    );
  }
}
