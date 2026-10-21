import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthenticatedRequest, FirebaseAuthGuard } from '../../../users/infrastructure/auth/firebase-auth.guard';
import { IdempotencyInterceptor } from '../../../../common/http/idempotency.interceptor';
import { ScheduleVacationCommand } from '../../application/commands/schedule-vacation.command';
import { ScheduleVacationHandler } from '../../application/commands/schedule-vacation.handler';
import { GetEmployeeVacationsQuery } from '../../application/queries/get-employee-vacations.query';
import { GetEmployeeVacationsHandler } from '../../application/queries/get-employee-vacations.handler';
import { GetVacationsCalendarQuery } from '../../application/queries/get-vacations-calendar.query';
import { GetVacationsCalendarHandler } from '../../application/queries/get-vacations-calendar.handler';
import { ScheduleVacationDto } from './dto/schedule-vacation.dto';
import { VacationsCalendarQueryDto } from './dto/vacations-calendar-query.dto';
import { parseDateOnly } from './dto/hr-date';
import { areaFilterCode } from '../../domain/hr-area-rules';
import type { VacationRequestResponse } from './dto/hr-administration.response';
import { toVacationRequestResponse } from './hr-administration.mapper';

@Controller()
@UseGuards(FirebaseAuthGuard)
export class VacationsController {
  constructor(
    private readonly scheduleVacation: ScheduleVacationHandler,
    private readonly getEmployeeVacations: GetEmployeeVacationsHandler,
    private readonly getVacationsCalendar: GetVacationsCalendarHandler,
  ) {}

  @Post('employees/:id/vacations')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(IdempotencyInterceptor)
  async schedule(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ScheduleVacationDto,
  ): Promise<VacationRequestResponse> {
    const created = await this.scheduleVacation.execute(
      new ScheduleVacationCommand(req.firebaseUid!, id, parseDateOnly(dto.startDate), parseDateOnly(dto.endDate), dto.notes),
    );
    return toVacationRequestResponse(created);
  }

  @Get('employees/:id/vacations')
  async listByEmployee(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<VacationRequestResponse[]> {
    const result = await this.getEmployeeVacations.execute(new GetEmployeeVacationsQuery(req.firebaseUid!, id));
    return result.items.map((v) =>
      toVacationRequestResponse(v, { employeeName: result.employeeName, areaName: result.areaName }),
    );
  }

  @Get('vacations/calendar')
  async calendar(
    @Req() req: AuthenticatedRequest,
    @Query() query: VacationsCalendarQueryDto,
  ): Promise<VacationRequestResponse[]> {
    const items = await this.getVacationsCalendar.execute(
      new GetVacationsCalendarQuery(req.firebaseUid!, query.companyId, query.branchId, query.year, query.month, query.areaCode ? areaFilterCode(query.areaCode) : query.areaId),
    );
    return items.map((v) =>
      toVacationRequestResponse(v, { employeeName: v.employee.fullName, areaName: v.employee.areaName }),
    );
  }
}
