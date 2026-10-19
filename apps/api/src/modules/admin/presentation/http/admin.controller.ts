import { Body, Controller, Get, Headers, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { parseVersionIfMatch } from '../../../../common/http/etag';
import { ListOrganizationUsersHandler } from '../../application/queries/list-organization-users.handler';
import { ListOrganizationUsersQuery } from '../../application/queries/list-organization-users.query';
import { GetOrganizationCompaniesHandler } from '../../application/queries/get-organization-companies.handler';
import { GetOrganizationCompaniesQuery } from '../../application/queries/get-organization-companies.query';
import { AssignUserToCompanyHandler } from '../../application/commands/assign-user-to-company.handler';
import { AssignUserToCompanyCommand } from '../../application/commands/assign-user-to-company.command';
import { DeactivateAssignmentHandler } from '../../application/commands/deactivate-assignment.handler';
import { DeactivateAssignmentCommand } from '../../application/commands/deactivate-assignment.command';
import { ListAuditEventsHandler } from '../../application/queries/list-audit-events.handler';
import { ListAuditEventsQuery } from '../../application/queries/list-audit-events.query';
import { GetReservationDepositPolicyHandler } from '../../application/queries/get-reservation-deposit-policy.handler';
import { GetReservationDepositPolicyQuery } from '../../application/queries/get-reservation-deposit-policy.query';
import { UpdateReservationDepositPolicyHandler } from '../../application/commands/update-reservation-deposit-policy.handler';
import { UpdateReservationDepositPolicyCommand } from '../../application/commands/update-reservation-deposit-policy.command';
import { GetRolePermissionMatrixHandler } from '../../application/queries/get-role-permission-matrix.handler';
import { GetRolePermissionMatrixQuery } from '../../application/queries/get-role-permission-matrix.query';
import { SaveRolePermissionMatrixHandler } from '../../application/commands/save-role-permission-matrix.handler';
import { SaveRolePermissionMatrixCommand } from '../../application/commands/save-role-permission-matrix.command';
import { ListRolesHandler } from '../../application/queries/list-roles.handler';
import { ListRolesQuery } from '../../application/queries/list-roles.query';
import { CreateRoleHandler } from '../../application/commands/create-role.handler';
import { CreateRoleCommand } from '../../application/commands/create-role.command';
import { RenameRoleHandler } from '../../application/commands/rename-role.handler';
import { RenameRoleCommand } from '../../application/commands/rename-role.command';
import { DeactivateRoleHandler } from '../../application/commands/deactivate-role.handler';
import { DeactivateRoleCommand } from '../../application/commands/deactivate-role.command';
import { GetNotificationTemplatesHandler } from '../../application/queries/get-notification-templates.handler';
import { GetNotificationTemplatesQuery } from '../../application/queries/get-notification-templates.query';
import { SaveNotificationTemplateHandler } from '../../application/commands/save-notification-template.handler';
import { SaveNotificationTemplateCommand } from '../../application/commands/save-notification-template.command';
import {
  AuthenticatedRequest,
  FirebaseAuthGuard,
} from '../../../users/infrastructure/auth/firebase-auth.guard';
import {
  CRITICAL_OPERATION_MFA_MAX_AGE_SECONDS,
  RecentAuth,
  RecentAuthGuard,
} from '../../../users/infrastructure/auth/recent-auth.guard';
import { GetOrganizationUsersDto } from './dto/get-organization-users.dto';
import { GetOrganizationCompaniesDto } from './dto/get-organization-companies.dto';
import { OrganizationCompaniesResponse } from './dto/organization-companies.response';
import { AssignUserDto } from './dto/assign-user.dto';
import { DeactivateAssignmentDto } from './dto/deactivate-assignment.dto';
import { OrganizationUsersResponse } from './dto/organization-user.response';
import { ListAuditEventsQueryDto } from './dto/list-audit-events-query.dto';
import { AuditEventsResponse } from './dto/audit-event.response';
import { GetReservationDepositPolicyQueryDto } from './dto/get-reservation-deposit-policy-query.dto';
import { UpdateReservationDepositPolicyDto } from './dto/update-reservation-deposit-policy.dto';
import { ReservationDepositPolicyResponse } from './dto/reservation-deposit-policy.response';
import { GetRolePermissionMatrixQueryDto } from './dto/get-role-permission-matrix-query.dto';
import { SaveRolePermissionMatrixDto } from './dto/save-role-permission-matrix.dto';
import { RolePermissionMatrixResponse } from './dto/role-permission-matrix.response';
import { ListRolesQueryDto } from './dto/list-roles-query.dto';
import { CreateRoleDto } from './dto/create-role.dto';
import { RenameRoleDto } from './dto/rename-role.dto';
import { DeactivateRoleDto } from './dto/deactivate-role.dto';
import { RoleResponse, RolesResponse } from './dto/role.response';
import { toRoleResponse } from './role.mapper';
import { GetNotificationTemplatesQueryDto } from './dto/get-notification-templates-query.dto';
import { SaveNotificationTemplateDto } from './dto/save-notification-template.dto';
import { NotificationTemplatesResponse } from './dto/notification-templates.response';

/**
 * ADM-01 (Usuarios y asignaciones, PANTALLAS-V2-B-SOPORTE.md). Solo rol
 * Administracion (assertAdminRoleAllowed) - deny-by-default igual que el
 * resto del backend.
 */
@Controller('admin')
@UseGuards(FirebaseAuthGuard)
export class AdminController {
  constructor(
    private readonly listOrganizationUsers: ListOrganizationUsersHandler,
    private readonly getOrganizationCompanies: GetOrganizationCompaniesHandler,
    private readonly assignUserToCompany: AssignUserToCompanyHandler,
    private readonly deactivateAssignment: DeactivateAssignmentHandler,
    private readonly listAuditEvents: ListAuditEventsHandler,
    private readonly getReservationDepositPolicy: GetReservationDepositPolicyHandler,
    private readonly updateReservationDepositPolicy: UpdateReservationDepositPolicyHandler,
    private readonly getRolePermissionMatrix: GetRolePermissionMatrixHandler,
    private readonly saveRolePermissionMatrix: SaveRolePermissionMatrixHandler,
    private readonly listRoles: ListRolesHandler,
    private readonly createRole: CreateRoleHandler,
    private readonly renameRole: RenameRoleHandler,
    private readonly deactivateRole: DeactivateRoleHandler,
    private readonly getNotificationTemplates: GetNotificationTemplatesHandler,
    private readonly saveNotificationTemplate: SaveNotificationTemplateHandler,
  ) {}

  @Get('users')
  async users(
    @Req() req: AuthenticatedRequest,
    @Query() query: GetOrganizationUsersDto,
  ): Promise<OrganizationUsersResponse> {
    const users = await this.listOrganizationUsers.execute(
      new ListOrganizationUsersQuery(req.firebaseUid!, query.companyId, query.branchId),
    );
    return { users };
  }

  @Get('companies')
  async companies(
    @Req() req: AuthenticatedRequest,
    @Query() query: GetOrganizationCompaniesDto,
  ): Promise<OrganizationCompaniesResponse> {
    const companies = await this.getOrganizationCompanies.execute(
      new GetOrganizationCompaniesQuery(req.firebaseUid!, query.companyId, query.branchId),
    );
    return { companies };
  }

  @Post('assignments')
  async assign(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AssignUserDto,
  ): Promise<{ id: string }> {
    return this.assignUserToCompany.execute(
      new AssignUserToCompanyCommand(
        req.firebaseUid!,
        dto.companyId,
        dto.branchId,
        dto.targetEmail,
        dto.targetCompanyId,
        dto.targetBranchId,
        dto.targetRoleId,
        dto.initialPassword,
      ),
    );
  }

  @Post('assignments/:id/deactivate')
  @HttpCode(204)
  async deactivate(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: DeactivateAssignmentDto,
  ): Promise<void> {
    await this.deactivateAssignment.execute(
      new DeactivateAssignmentCommand(req.firebaseUid!, dto.companyId, dto.branchId, id),
    );
  }

  @Get('audit-events')
  async auditEvents(
    @Req() req: AuthenticatedRequest,
    @Query() query: ListAuditEventsQueryDto,
  ): Promise<AuditEventsResponse> {
    const events = await this.listAuditEvents.execute(
      new ListAuditEventsQuery(
        req.firebaseUid!,
        query.companyId,
        query.branchId,
        query.actorUid,
        query.entityType,
        query.dateFrom,
        query.dateTo,
      ),
    );
    return { events };
  }

  @Get('parameters/reservation-deposit-policy')
  async reservationDepositPolicy(
    @Req() req: AuthenticatedRequest,
    @Query() query: GetReservationDepositPolicyQueryDto,
  ): Promise<ReservationDepositPolicyResponse> {
    return this.getReservationDepositPolicy.execute(
      new GetReservationDepositPolicyQuery(req.firebaseUid!, query.companyId, query.branchId),
    );
  }

  @Post('parameters/reservation-deposit-policy')
  async saveReservationDepositPolicy(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateReservationDepositPolicyDto,
  ) {
    return this.updateReservationDepositPolicy.execute(
      new UpdateReservationDepositPolicyCommand(req.firebaseUid!, dto.companyId, dto.branchId, dto.amount, dto.currency),
    );
  }

  @Get('permissions')
  async permissions(
    @Req() req: AuthenticatedRequest,
    @Query() query: GetRolePermissionMatrixQueryDto,
  ): Promise<RolePermissionMatrixResponse> {
    return this.getRolePermissionMatrix.execute(
      new GetRolePermissionMatrixQuery(req.firebaseUid!, query.companyId, query.branchId, query.scopeCompanyId, query.scopeBranchId),
    );
  }

  // ADM-02 punto 10 / SEC-F4: guardar cambios de permisos requiere MFA de los ultimos 5 min.
  @Post('permissions')
  @UseGuards(RecentAuthGuard)
  @RecentAuth(CRITICAL_OPERATION_MFA_MAX_AGE_SECONDS)
  async savePermissions(@Req() req: AuthenticatedRequest, @Body() dto: SaveRolePermissionMatrixDto) {
    return this.saveRolePermissionMatrix.execute(
      new SaveRolePermissionMatrixCommand(
        req.firebaseUid!,
        dto.companyId,
        dto.branchId,
        dto.entries,
        dto.scopeCompanyId,
        dto.scopeBranchId,
      ),
    );
  }

  /** ADM-02 - roles dinamicos de la organizacion (ADMIN.MANAGE_PERMISSIONS). */
  @Get('roles')
  async roles(@Req() req: AuthenticatedRequest, @Query() query: ListRolesQueryDto): Promise<RolesResponse> {
    const roles = await this.listRoles.execute(
      new ListRolesQuery(req.firebaseUid!, query.companyId, query.branchId, query.includeInactive === 'true'),
    );
    return { roles: roles.map(toRoleResponse) };
  }

  @Post('roles')
  async createRoleEndpoint(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateRoleDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RoleResponse> {
    const created = await this.createRole.execute(new CreateRoleCommand(req.firebaseUid!, dto.companyId, dto.branchId, dto.name));
    res.setHeader('ETag', `"${created.version}"`);
    return toRoleResponse(created);
  }

  /** Renombrar con If-Match = version del rol (428 si falta, 412 VERSION_CONFLICT si cambio). */
  @Patch('roles/:id')
  async renameRoleEndpoint(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RenameRoleDto,
    @Headers('if-match') ifMatch: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RoleResponse> {
    const renamed = await this.renameRole.execute(
      new RenameRoleCommand(id, req.firebaseUid!, dto.companyId, dto.branchId, parseVersionIfMatch(ifMatch), dto.name),
    );
    res.setHeader('ETag', `"${renamed.version}"`);
    return toRoleResponse(renamed);
  }

  @Post('roles/:id/deactivate')
  @HttpCode(200)
  async deactivateRoleEndpoint(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DeactivateRoleDto,
    @Headers('if-match') ifMatch: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RoleResponse> {
    const deactivated = await this.deactivateRole.execute(
      new DeactivateRoleCommand(id, req.firebaseUid!, dto.companyId, dto.branchId, parseVersionIfMatch(ifMatch)),
    );
    res.setHeader('ETag', `"${deactivated.version}"`);
    return toRoleResponse(deactivated);
  }

  @Get('notification-templates')
  async notificationTemplates(
    @Req() req: AuthenticatedRequest,
    @Query() query: GetNotificationTemplatesQueryDto,
  ): Promise<NotificationTemplatesResponse> {
    return this.getNotificationTemplates.execute(
      new GetNotificationTemplatesQuery(req.firebaseUid!, query.companyId, query.branchId),
    );
  }

  @Post('notification-templates')
  async saveNotificationTemplateEndpoint(@Req() req: AuthenticatedRequest, @Body() dto: SaveNotificationTemplateDto) {
    return this.saveNotificationTemplate.execute(
      new SaveNotificationTemplateCommand(req.firebaseUid!, dto.companyId, dto.branchId, dto.eventType, dto.channels, dto.body),
    );
  }
}
