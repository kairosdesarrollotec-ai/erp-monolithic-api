import { Body, Controller, Get, HttpCode, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ListOrganizationUsersHandler } from '../../application/queries/list-organization-users.handler';
import { ListOrganizationUsersQuery } from '../../application/queries/list-organization-users.query';
import { AssignUserToCompanyHandler } from '../../application/commands/assign-user-to-company.handler';
import { AssignUserToCompanyCommand } from '../../application/commands/assign-user-to-company.command';
import { DeactivateAssignmentHandler } from '../../application/commands/deactivate-assignment.handler';
import { DeactivateAssignmentCommand } from '../../application/commands/deactivate-assignment.command';
import {
  AuthenticatedRequest,
  FirebaseAuthGuard,
} from '../../../users/infrastructure/auth/firebase-auth.guard';
import { GetOrganizationUsersDto } from './dto/get-organization-users.dto';
import { AssignUserDto } from './dto/assign-user.dto';
import { DeactivateAssignmentDto } from './dto/deactivate-assignment.dto';
import { OrganizationUsersResponse } from './dto/organization-user.response';

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
  ): Promise<{ id: string }> {
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
}
