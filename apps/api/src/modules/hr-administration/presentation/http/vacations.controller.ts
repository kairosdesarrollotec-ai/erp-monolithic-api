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
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthenticatedRequest, FirebaseAuthGuard } from '../../../users/infrastructure/auth/firebase-auth.guard';
import { IdempotencyInterceptor } from '../../../../common/http/idempotency.interceptor';
import { ScheduleVacationCommand } from '../../application/commands/schedule-vacation.command';
import { ScheduleVacationHandler } from '../../application/commands/schedule-vacation.handler';
import { RescheduleVacationCommand } from '../../application/commands/reschedule-vacation.command';
import { RescheduleVacationHandler } from '../../application/commands/reschedule-vacation.handler';
import { CancelVacationCommand } from '../../application/commands/cancel-vacation.command';
import { CancelVacationHandler } from '../../application/commands/cancel-vacation.handler';
import { ResolveVacationCommand } from '../../application/commands/resolve-vacation.command';
import { ResolveVacationHandler } from '../../application/commands/resolve-vacation.handler';
import { GetEmployeeVacationsQuery } from '../../application/queries/get-employee-vacations.query';
import { GetEmployeeVacationsHandler } from '../../application/queries/get-employee-vacations.handler';
import { GetVacationsCalendarQuery } from '../../application/queries/get-vacations-calendar.query';
import { GetVacationsCalendarHandler } from '../../application/queries/get-vacations-calendar.handler';
import { ScheduleVacationDto } from './dto/schedule-vacation.dto';
import { CancelVacationDto, RescheduleVacationDto } from './dto/change-vacation.dto';
import { ResolveVacationDto } from './dto/resolve-vacation.dto';
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
    private readonly rescheduleVacation: RescheduleVacationHandler,
    private readonly cancelVacation: CancelVacationHandler,
    private readonly resolveVacation: ResolveVacationHandler,
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

  /** #10 (22-oct): reprograma las vacaciones a otra fecha libre del area (sin lista de espera); estado REPROGRAMADA. */
  @Post('vacations/:id/reschedule')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(IdempotencyInterceptor)
  async reschedule(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RescheduleVacationDto,
  ): Promise<VacationRequestResponse> {
    const updated = await this.rescheduleVacation.execute(
      new RescheduleVacationCommand(req.firebaseUid!, id, parseDateOnly(dto.startDate), parseDateOnly(dto.endDate), dto.reason),
    );
    return toVacationRequestResponse(updated);
  }

  /** #10 (22-oct): cancela las vacaciones (libera el cupo); estado CANCELADA, motivo obligatorio. */
  @Post('vacations/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(IdempotencyInterceptor)
  async cancel(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelVacationDto,
  ): Promise<VacationRequestResponse> {
    const updated = await this.cancelVacation.execute(new CancelVacationCommand(req.firebaseUid!, id, dto.reason));
    return toVacationRequestResponse(updated);
  }

  /** R4 (23-oct): Gerencia aprueba vacaciones (soporta grantedDays menor a solicitado), reprograma o rechaza/cancela. */
  @Patch('vacations/:id/resolve')
  async resolve(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveVacationDto,
  ): Promise<VacationRequestResponse> {
    const updated = await this.resolveVacation.execute(
      new ResolveVacationCommand(req.firebaseUid!, id, dto.status, dto.grantedDays, dto.statusReason),
    );
    return toVacationRequestResponse(updated);
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
