import { Body, Controller, Get, HttpCode, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ListOrganizationUsersHandler } from '../../application/queries/list-organization-users.handler';
import { ListOrganizationUsersQuery } from '../../application/queries/list-organization-users.query';
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
import { GetNotificationTemplatesHandler } from '../../application/queries/get-notification-templates.handler';
import { GetNotificationTemplatesQuery } from '../../application/queries/get-notification-templates.query';
import { SaveNotificationTemplateHandler } from '../../application/commands/save-notification-template.handler';
import { SaveNotificationTemplateCommand } from '../../application/commands/save-notification-template.command';
import {
  AuthenticatedRequest,
  FirebaseAuthGuard,
} from '../../../users/infrastructure/auth/firebase-auth.guard';
import { GetOrganizationUsersDto } from './dto/get-organization-users.dto';
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
    private readonly assignUserToCompany: AssignUserToCompanyHandler,
    private readonly deactivateAssignment: DeactivateAssignmentHandler,
    private readonly listAuditEvents: ListAuditEventsHandler,
    private readonly getReservationDepositPolicy: GetReservationDepositPolicyHandler,
    private readonly updateReservationDepositPolicy: UpdateReservationDepositPolicyHandler,
    private readonly getRolePermissionMatrix: GetRolePermissionMatrixHandler,
    private readonly saveRolePermissionMatrix: SaveRolePermissionMatrixHandler,
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

  @Post('assignments')
  async assign(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AssignUserDto,
  ): Promise<{ id: string; passwordResetLink: string | null }> {
    return this.assignUserToCompany.execute(
      new AssignUserToCompanyCommand(
        req.firebaseUid!,
        dto.companyId,
        dto.branchId,
        dto.targetEmail,
        dto.targetCompanyId,
        dto.targetBranchId,
        dto.targetRole,
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
      new GetRolePermissionMatrixQuery(req.firebaseUid!, query.companyId, query.branchId),
    );
  }

  @Post('permissions')
  async savePermissions(@Req() req: AuthenticatedRequest, @Body() dto: SaveRolePermissionMatrixDto) {
    return this.saveRolePermissionMatrix.execute(
      new SaveRolePermissionMatrixCommand(req.firebaseUid!, dto.companyId, dto.branchId, dto.entries),
    );
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
