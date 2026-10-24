import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthenticatedRequest, FirebaseAuthGuard } from '../../../users/infrastructure/auth/firebase-auth.guard';
import { IdempotencyInterceptor } from '../../../../common/http/idempotency.interceptor';
import { GetMyEmployeeQuery } from '../../application/queries/get-my-employee.query';
import { GetMyEmployeeHandler } from '../../application/queries/get-my-employee.handler';
import { RequestLeaveHandler } from '../../application/commands/request-leave.handler';
import { RequestLeaveCommand } from '../../application/commands/request-leave.command';
import { RequestVacationHandler } from '../../application/commands/request-vacation.handler';
import { RequestVacationCommand } from '../../application/commands/request-vacation.command';
import { LeaveRepositoryPort } from '../../application/ports/leave-repository.port';
import { VacationRepositoryPort } from '../../application/ports/vacation-repository.port';
import { MyEmployeeQueryDto } from './dto/my-employee-query.dto';
import { RequestLeaveDto } from './dto/request-leave.dto';
import { ScheduleVacationDto } from './dto/schedule-vacation.dto';
import { parseDateOnly } from './dto/hr-date';
import type {
  LeaveRequestResponse,
  MyEmployeeResponse,
  VacationRequestResponse,
} from './dto/hr-administration.response';
import { toLeaveRequestResponse, toMyEmployeeResponse, toVacationRequestResponse } from './hr-administration.mapper';

/**
 * GET /me/employee: la ficha del propio usuario (ADP-06).
 * R4: Autoservicio de vacaciones y permisos (/me/leaves, /me/vacations).
 */
@Controller('me')
@UseGuards(FirebaseAuthGuard)
export class MeEmployeeController {
  constructor(
    private readonly getMyEmployee: GetMyEmployeeHandler,
    private readonly requestLeave: RequestLeaveHandler,
    private readonly requestVacation: RequestVacationHandler,
    private readonly leaves: LeaveRepositoryPort,
    private readonly vacations: VacationRepositoryPort,
  ) {}

  @Get('employee')
  async employee(@Req() req: AuthenticatedRequest, @Query() query: MyEmployeeQueryDto): Promise<MyEmployeeResponse> {
    const employee = await this.getMyEmployee.execute(
      new GetMyEmployeeQuery(req.firebaseUid!, query.companyId, query.branchId),
    );
    return toMyEmployeeResponse(employee);
  }

  @Get('leaves')
  async listMyLeaves(
    @Req() req: AuthenticatedRequest,
    @Query() query: MyEmployeeQueryDto,
  ): Promise<LeaveRequestResponse[]> {
    const employee = await this.getMyEmployee.execute(
      new GetMyEmployeeQuery(req.firebaseUid!, query.companyId, query.branchId),
    );
    const items = await this.leaves.findByEmployee(employee.id);
    return items.map((l) => toLeaveRequestResponse(l, employee.fullName));
  }

  @Post('leaves')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(IdempotencyInterceptor)
  async requestMyLeave(
    @Req() req: AuthenticatedRequest,
    @Query() query: MyEmployeeQueryDto,
    @Body() dto: RequestLeaveDto,
  ): Promise<LeaveRequestResponse> {
    const employee = await this.getMyEmployee.execute(
      new GetMyEmployeeQuery(req.firebaseUid!, query.companyId, query.branchId),
    );
    const created = await this.requestLeave.execute(
      new RequestLeaveCommand(
        req.firebaseUid!,
        employee.id,
        dto.type,
        parseDateOnly(dto.date),
        dto.reason,
        dto.startTime ? new Date(dto.startTime) : null,
        dto.endTime ? new Date(dto.endTime) : null,
      ),
    );
    return toLeaveRequestResponse(created, employee.fullName);
  }

  @Get('vacations')
  async listMyVacations(
    @Req() req: AuthenticatedRequest,
    @Query() query: MyEmployeeQueryDto,
  ): Promise<VacationRequestResponse[]> {
    const employee = await this.getMyEmployee.execute(
      new GetMyEmployeeQuery(req.firebaseUid!, query.companyId, query.branchId),
    );
    const items = await this.vacations.findByEmployee(employee.id);
    return items.map((v) =>
      toVacationRequestResponse(v, { employeeName: employee.fullName, areaName: employee.areaName }),
    );
  }

  @Post('vacations')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(IdempotencyInterceptor)
  async requestMyVacation(
    @Req() req: AuthenticatedRequest,
    @Query() query: MyEmployeeQueryDto,
    @Body() dto: ScheduleVacationDto,
  ): Promise<VacationRequestResponse> {
    const employee = await this.getMyEmployee.execute(
      new GetMyEmployeeQuery(req.firebaseUid!, query.companyId, query.branchId),
    );
    const created = await this.requestVacation.execute(
      new RequestVacationCommand(
        req.firebaseUid!,
        employee.id,
        parseDateOnly(dto.startDate),
        parseDateOnly(dto.endDate),
        dto.notes,
      ),
    );
    return toVacationRequestResponse(created, { employeeName: employee.fullName, areaName: employee.areaName });
  }
}
