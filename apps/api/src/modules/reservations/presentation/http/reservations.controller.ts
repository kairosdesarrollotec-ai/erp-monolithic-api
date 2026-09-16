import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  AuthenticatedRequest,
  FirebaseAuthGuard,
} from '../../../users/infrastructure/auth/firebase-auth.guard';
import { CreateReservationHandler } from '../../application/commands/create-reservation.handler';
import { CreateReservationCommand } from '../../application/commands/create-reservation.command';
import { RegisterPaymentHandler } from '../../application/commands/register-payment.handler';
import { RegisterPaymentCommand } from '../../application/commands/register-payment.command';
import { RegisterDocumentsHandler } from '../../application/commands/register-documents.handler';
import { RegisterDocumentsCommand } from '../../application/commands/register-documents.command';
import { ConfirmReservationHandler } from '../../application/commands/confirm-reservation.handler';
import { ConfirmReservationCommand } from '../../application/commands/confirm-reservation.command';
import { CancelReservationHandler } from '../../application/commands/cancel-reservation.handler';
import { CancelReservationCommand } from '../../application/commands/cancel-reservation.command';
import { GetReservationHandler } from '../../application/queries/get-reservation.handler';
import { GetReservationQuery } from '../../application/queries/get-reservation.query';
import { ListReservationsHandler } from '../../application/queries/list-reservations.handler';
import { ListReservationsQuery } from '../../application/queries/list-reservations.query';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { CommandScopeDto } from './dto/command-scope.dto';
import { CancelReservationDto } from './dto/cancel-reservation.dto';
import { ListReservationsQueryDto } from './dto/list-reservations-query.dto';
import { ReservationResponse } from './dto/reservation.response';
import { toReservationResponse } from './reservation.mapper';

function parseIfMatch(ifMatch: string | undefined): number {
  if (!ifMatch) {
    throw new BadRequestException('Falta el header If-Match con la version vigente de la reserva.');
  }
  const version = Number(ifMatch.replace(/"/g, ''));
  if (!Number.isInteger(version)) {
    throw new BadRequestException('El header If-Match debe ser un numero de version valido.');
  }
  return version;
}

/**
 * TDD-RES-001.md seccion 11 - contrato HTTP de Reserva (HU-27). No expone
 * ningun comando de "reprogramar" (BR-RES-003) ni operaciones de venta de
 * vehiculo/conversion a alquiler (RES-06/07/08, ALQ-02) - fuera de
 * alcance de este primer corte, ver tarea HU-27 en ClickUp.
 */
@Controller('reservations')
@UseGuards(FirebaseAuthGuard)
export class ReservationsController {
  constructor(
    private readonly createReservation: CreateReservationHandler,
    private readonly registerPayment: RegisterPaymentHandler,
    private readonly registerDocuments: RegisterDocumentsHandler,
    private readonly confirmReservation: ConfirmReservationHandler,
    private readonly cancelReservation: CancelReservationHandler,
    private readonly getReservation: GetReservationHandler,
    private readonly listReservations: ListReservationsHandler,
  ) {}

  @Post()
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateReservationDto,
  ): Promise<ReservationResponse> {
    const created = await this.createReservation.execute(
      new CreateReservationCommand(
        req.firebaseUid!,
        dto.companyId,
        dto.branchId,
        dto.inquiryId,
        dto.customerId,
        dto.vehicleId,
        dto.channelMode,
        new Date(dto.startAt),
        new Date(dto.endAt),
      ),
    );
    return toReservationResponse(created);
  }

  @Get()
  async list(
    @Req() req: AuthenticatedRequest,
    @Query() query: ListReservationsQueryDto,
  ): Promise<ReservationResponse[]> {
    if (!query.companyId) {
      throw new BadRequestException('companyId es requerido.');
    }
    const results = await this.listReservations.execute(
      new ListReservationsQuery(req.firebaseUid!, query.companyId, query.companyId, query.status),
    );
    return results.map(toReservationResponse);
  }

  @Get(':id')
  async detail(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Query('companyId') companyId: string,
    @Query('branchId') branchId: string,
  ): Promise<ReservationResponse> {
    const reservation = await this.getReservation.execute(
      new GetReservationQuery(id, req.firebaseUid!, companyId, branchId),
    );
    return toReservationResponse(reservation);
  }

  @Post(':id/commands/register-payment')
  async registerPaymentCommand(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: CommandScopeDto,
    @Headers('if-match') ifMatch: string,
  ): Promise<ReservationResponse> {
    const updated = await this.registerPayment.execute(
      new RegisterPaymentCommand(id, req.firebaseUid!, dto.companyId, dto.branchId, parseIfMatch(ifMatch)),
    );
    return toReservationResponse(updated);
  }

  @Post(':id/commands/register-documents')
  async registerDocumentsCommand(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: CommandScopeDto,
    @Headers('if-match') ifMatch: string,
  ): Promise<ReservationResponse> {
    const updated = await this.registerDocuments.execute(
      new RegisterDocumentsCommand(id, req.firebaseUid!, dto.companyId, dto.branchId, parseIfMatch(ifMatch)),
    );
    return toReservationResponse(updated);
  }

  @Post(':id/commands/confirm')
  async confirm(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: CommandScopeDto,
    @Headers('if-match') ifMatch: string,
  ): Promise<ReservationResponse> {
    const confirmed = await this.confirmReservation.execute(
      new ConfirmReservationCommand(id, req.firebaseUid!, dto.companyId, dto.branchId, parseIfMatch(ifMatch)),
    );
    return toReservationResponse(confirmed);
  }

  @Post(':id/commands/cancel')
  @HttpCode(200)
  async cancel(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: CancelReservationDto,
    @Headers('if-match') ifMatch: string,
  ): Promise<ReservationResponse> {
    const cancelled = await this.cancelReservation.execute(
      new CancelReservationCommand(
        id,
        req.firebaseUid!,
        dto.companyId,
        dto.branchId,
        parseIfMatch(ifMatch),
        dto.reason,
        dto.note,
      ),
    );
    return toReservationResponse(cancelled);
  }
}
