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
import { RequestFieldTripCommand } from '../../application/commands/request-field-trip.command';
import { RequestFieldTripHandler } from '../../application/commands/request-field-trip.handler';
import { AuthorizeFieldTripCommand } from '../../application/commands/authorize-field-trip.command';
import { AuthorizeFieldTripHandler } from '../../application/commands/authorize-field-trip.handler';
import { AdvanceFieldTripTimeoutCommand } from '../../application/commands/advance-field-trip-timeout.command';
import { AdvanceFieldTripTimeoutHandler } from '../../application/commands/advance-field-trip-timeout.handler';
import { EvaluateFieldTripReturnCommand } from '../../application/commands/evaluate-field-trip-return.command';
import { EvaluateFieldTripReturnHandler } from '../../application/commands/evaluate-field-trip-return.handler';
import { RejectFieldTripCommand } from '../../application/commands/reject-field-trip.command';
import { RejectFieldTripHandler } from '../../application/commands/reject-field-trip.handler';
import { ListFieldTripsQuery } from '../../application/queries/list-field-trips.query';
import { ListFieldTripsHandler } from '../../application/queries/list-field-trips.handler';
import { GetFieldTripQuery } from '../../application/queries/get-field-trip.query';
import { GetFieldTripHandler } from '../../application/queries/get-field-trip.handler';
import { RequestFieldTripDto } from './dto/request-field-trip.dto';
import { ListFieldTripsQueryDto } from './dto/list-field-trips-query.dto';
import { AuthorizeFieldTripDto } from './dto/authorize-field-trip.dto';
import { RejectFieldTripDto } from './dto/reject-field-trip.dto';
import { EvaluateFieldTripReturnDto } from './dto/evaluate-field-trip-return.dto';
import type { FieldTripResponse } from './dto/hr-administration.response';
import { toFieldTripResponse } from './hr-administration.mapper';

@Controller()
@UseGuards(FirebaseAuthGuard)
export class FieldTripsController {
  constructor(
    private readonly requestFieldTrip: RequestFieldTripHandler,
    private readonly authorizeFieldTrip: AuthorizeFieldTripHandler,
    private readonly rejectFieldTrip: RejectFieldTripHandler,
    private readonly advanceTimeout: AdvanceFieldTripTimeoutHandler,
    private readonly evaluateReturn: EvaluateFieldTripReturnHandler,
    private readonly listFieldTrips: ListFieldTripsHandler,
    private readonly getFieldTrip: GetFieldTripHandler,
  ) {}

  @Post('employees/:id/field-trips')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(IdempotencyInterceptor)
  async request(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RequestFieldTripDto,
  ): Promise<FieldTripResponse> {
    const created = await this.requestFieldTrip.execute(
      new RequestFieldTripCommand(
        req.firebaseUid!,
        id,
        dto.destination,
        dto.objective,
        new Date(dto.estimatedDeparture),
        new Date(dto.estimatedReturn),
      ),
    );
    return toFieldTripResponse(created);
  }

  @Get('field-trips')
  async list(
    @Req() req: AuthenticatedRequest,
    @Query() query: ListFieldTripsQueryDto,
  ): Promise<FieldTripResponse[]> {
    const items = await this.listFieldTrips.execute(
      new ListFieldTripsQuery(req.firebaseUid!, query.companyId, query.branchId, query.status, query.employeeId),
    );
    return items.map((f) => toFieldTripResponse(f, { employeeName: f.employee.fullName, message: messageFor(f) }));
  }

  @Get('field-trips/:id')
  async detail(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string): Promise<FieldTripResponse> {
    const fieldTrip = await this.getFieldTrip.execute(new GetFieldTripQuery(req.firebaseUid!, id));
    return toFieldTripResponse(fieldTrip, { employeeName: fieldTrip.employee.fullName, message: messageFor(fieldTrip) });
  }

  @Post('field-trips/:id/authorize')
  @HttpCode(HttpStatus.OK)
  async authorize(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AuthorizeFieldTripDto,
  ): Promise<FieldTripResponse> {
    const authorized = await this.authorizeFieldTrip.execute(
      new AuthorizeFieldTripCommand(req.firebaseUid!, id, dto.authorizationLevel, dto.notes),
    );
    return toFieldTripResponse(authorized);
  }

  @Post('field-trips/:id/reject')
  @HttpCode(HttpStatus.OK)
  async reject(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectFieldTripDto,
  ): Promise<FieldTripResponse> {
    const rejected = await this.rejectFieldTrip.execute(new RejectFieldTripCommand(req.firebaseUid!, id, dto.reason));
    return toFieldTripResponse(rejected, { message: REJECTED_MESSAGE });
  }

  @Post('field-trips/:id/advance-timeout')
  @HttpCode(HttpStatus.OK)
  async advance(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string): Promise<FieldTripResponse> {
    const result = await this.advanceTimeout.execute(new AdvanceFieldTripTimeoutCommand(req.firebaseUid!, id));
    return toFieldTripResponse(result.fieldTrip, { message: result.message ?? null });
  }

  @Post('field-trips/:id/return')
  @HttpCode(HttpStatus.OK)
  async registerReturn(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EvaluateFieldTripReturnDto,
  ): Promise<FieldTripResponse> {
    const result = await this.evaluateReturn.execute(
      new EvaluateFieldTripReturnCommand(req.firebaseUid!, id, new Date(dto.actualReturn), dto.returnNotes),
    );
    return toFieldTripResponse(result.fieldTrip, { message: result.message, memo: result.memo });
  }
}

const NO_AUTHORIZATION_MESSAGE =
  'Nadie autorizó. La persona no sale; la decisión de a quién más consultar es manual, fuera del sistema. No existe un 4to nivel automático (BR-ADP-004).';
const REJECTED_MESSAGE = 'La salida fue rechazada. La persona no sale.';

/** Mensaje de negocio de una salida sin autorización: rechazo explícito o cascada agotada sin respuesta. */
function messageFor(f: { status: string; rejectedAt: Date | null }): string | null {
  if (f.status !== 'NO_AUTORIZADA') return null;
  return f.rejectedAt ? REJECTED_MESSAGE : NO_AUTHORIZATION_MESSAGE;
}
