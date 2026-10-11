import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthenticatedRequest, FirebaseAuthGuard } from '../../../users/infrastructure/auth/firebase-auth.guard';
import { IdempotencyInterceptor } from '../../../../common/http/idempotency.interceptor';
import { RequestLeaveCommand } from '../../application/commands/request-leave.command';
import { RequestLeaveHandler } from '../../application/commands/request-leave.handler';
import { ResolveLeaveCommand } from '../../application/commands/resolve-leave.command';
import { ResolveLeaveHandler } from '../../application/commands/resolve-leave.handler';
import { GetEmployeeLeavesQuery } from '../../application/queries/get-employee-leaves.query';
import { GetEmployeeLeavesHandler } from '../../application/queries/get-employee-leaves.handler';
import { RequestLeaveDto } from './dto/request-leave.dto';
import { ResolveLeaveDto } from './dto/resolve-leave.dto';
import { parseDateOnly } from './dto/hr-date';
import type { LeaveRequestResponse } from './dto/hr-administration.response';
import { toLeaveRequestResponse } from './hr-administration.mapper';

@Controller()
@UseGuards(FirebaseAuthGuard)
export class LeavesController {
  constructor(
    private readonly requestLeave: RequestLeaveHandler,
    private readonly resolveLeave: ResolveLeaveHandler,
    private readonly getEmployeeLeaves: GetEmployeeLeavesHandler,
  ) {}

  @Post('employees/:id/leaves')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(IdempotencyInterceptor)
  async request(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RequestLeaveDto,
  ): Promise<LeaveRequestResponse> {
    const created = await this.requestLeave.execute(
      new RequestLeaveCommand(
        req.firebaseUid!,
        id,
        dto.type,
        parseDateOnly(dto.date),
        dto.reason,
        dto.startTime ? new Date(dto.startTime) : null,
        dto.endTime ? new Date(dto.endTime) : null,
      ),
    );
    return toLeaveRequestResponse(created);
  }

  @Get('employees/:id/leaves')
  async listByEmployee(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<LeaveRequestResponse[]> {
    const result = await this.getEmployeeLeaves.execute(new GetEmployeeLeavesQuery(req.firebaseUid!, id));
    return result.items.map((l) => toLeaveRequestResponse(l, result.employeeName));
  }

  @Patch('leaves/:id/resolve')
  async resolve(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveLeaveDto,
  ): Promise<LeaveRequestResponse> {
    const resolved = await this.resolveLeave.execute(
      new ResolveLeaveCommand(req.firebaseUid!, id, dto.status, dto.resolutionNotes),
    );
    return toLeaveRequestResponse(resolved);
  }
}
