import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
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
import {
  AuthenticatedRequest,
  FirebaseAuthGuard,
} from '../../../users/infrastructure/auth/firebase-auth.guard';
import { parseVersionIfMatch } from '../../../../common/http/etag';
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
import { GetReservationQueryDto } from './dto/get-reservation-query.dto';
import { ReservationResponse } from './dto/reservation.response';
import { toReservationResponse } from './reservation.mapper';
import { IdempotencyInterceptor } from '../../../../common/http/idempotency.interceptor';
import { RESERVATION_LIST_MAX_LIMIT } from '../../domain/reservation-pagination';
import { RequestReservationDocumentUploadSessionHandler } from '../../application/commands/request-reservation-document-upload-session.handler';
import { RecordReservationDocumentHandler } from '../../application/commands/record-reservation-document.handler';
import { ListReservationDocumentsHandler } from '../../application/queries/list-reservation-documents.handler';
import { RequestReservationDocumentUploadSessionDto } from './dto/request-reservation-document-upload-session.dto';
import { RecordReservationDocumentDto } from './dto/record-reservation-document.dto';
import { ReservationDocumentRecord } from '../../application/ports/reservation-document-repository.port';

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
    private readonly requestDocumentUploadSession: RequestReservationDocumentUploadSessionHandler,
    private readonly recordDocument: RecordReservationDocumentHandler,
    private readonly listDocuments: ListReservationDocumentsHandler,
  ) {}

  @Post()
  @UseInterceptors(IdempotencyInterceptor)
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateReservationDto,
  ): Promise<ReservationResponse> {
    const created = await this.createReservation.execute(
      new CreateReservationCommand(
        req.firebaseUid!,
        dto.companyId,
        dto.branchId,
        dto.customerId,
        dto.vehicleId,
        dto.channelMode,
        new Date(dto.startAt),
        new Date(dto.endAt),
        dto.requiredPaymentAmount,
        dto.currency,
        dto.paymentPolicyVersion,
        dto.inquiryId,
      ),
    );
    return toReservationResponse(created);
  }

  /**
   * Hallazgo critico de revision PR#6 ("bug de bandeja: companyId
   * enviado como branchId"): antes se construia
   * `new ListReservationsQuery(req.firebaseUid!, query.companyId,
   * query.companyId, query.status)` - el TERCER argumento (branchId)
   * recibia `query.companyId` de nuevo en vez de `query.branchId`, asi
   * que la bandeja SIEMPRE quedaba vacia (ningun branchId real coincide
   * con un companyId). `branchId` ahora es su propio parametro
   * obligatorio (ver ListReservationsQueryDto) y se pasa tal cual.
   */
  @Get()
  async list(
    @Req() req: AuthenticatedRequest,
    @Query() query: ListReservationsQueryDto,
  ): Promise<ReservationResponse[]> {
    // Hallazgo MEDIO de revision PR#6 ("sin limite maximo de pagina"):
    // el DTO solo garantizaba que `limit` fuera un entero positivo, no que
    // tuviera un techo - un cliente (o un bug de frontend) podia pedir
    // `limit=999999` y traer la tabla completa en una sola respuesta.
    const MAX_LIMIT = RESERVATION_LIST_MAX_LIMIT;
    const requestedLimit = query.limit ? Number(query.limit) : undefined;
    if (requestedLimit !== undefined && requestedLimit > MAX_LIMIT) {
      throw new BadRequestException(`limit no puede ser mayor a ${MAX_LIMIT}.`);
    }
    const limit = requestedLimit;
    let cursor: { createdAt: Date; id: string } | undefined;
    if (query.cursorCreatedAt || query.cursorId) {
      if (!query.cursorCreatedAt || !query.cursorId) {
        throw new BadRequestException(
          'cursorCreatedAt y cursorId deben enviarse juntos para paginar.',
        );
      }
      cursor = { createdAt: new Date(query.cursorCreatedAt), id: query.cursorId };
    }

    const results = await this.listReservations.execute(
      new ListReservationsQuery(
        req.firebaseUid!,
        query.companyId,
        query.branchId,
        query.status,
        limit ?? 20,
        cursor,
      ),
    );
    return results.map(toReservationResponse);
  }

  @Get(':id')
  async detail(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: GetReservationQueryDto,
  ): Promise<ReservationResponse> {
    const reservation = await this.getReservation.execute(
      new GetReservationQuery(id, req.firebaseUid!, query.companyId, query.branchId),
    );
    return toReservationResponse(reservation);
  }

  @Post(':id/commands/register-payment')
  @HttpCode(200)
  @UseInterceptors(IdempotencyInterceptor)
  async registerPaymentCommand(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CommandScopeDto,
    @Headers('if-match') ifMatch: string,
  ): Promise<ReservationResponse> {
    const updated = await this.registerPayment.execute(
      new RegisterPaymentCommand(
        id,
        req.firebaseUid!,
        dto.companyId,
        dto.branchId,
        parseVersionIfMatch(ifMatch),
      ),
    );
    return toReservationResponse(updated);
  }

  @Post(':id/commands/register-documents')
  @HttpCode(200)
  @UseInterceptors(IdempotencyInterceptor)
  async registerDocumentsCommand(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CommandScopeDto,
    @Headers('if-match') ifMatch: string,
  ): Promise<ReservationResponse> {
    const updated = await this.registerDocuments.execute(
      new RegisterDocumentsCommand(
        id,
        req.firebaseUid!,
        dto.companyId,
        dto.branchId,
        parseVersionIfMatch(ifMatch),
      ),
    );
    return toReservationResponse(updated);
  }

  @Post(':id/commands/confirm')
  @HttpCode(200)
  @UseInterceptors(IdempotencyInterceptor)
  async confirm(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CommandScopeDto,
    @Headers('if-match') ifMatch: string,
  ): Promise<ReservationResponse> {
    const confirmed = await this.confirmReservation.execute(
      new ConfirmReservationCommand(
        id,
        req.firebaseUid!,
        dto.companyId,
        dto.branchId,
        parseVersionIfMatch(ifMatch),
      ),
    );
    return toReservationResponse(confirmed);
  }

  @Post(':id/commands/cancel')
  @HttpCode(200)
  @UseInterceptors(IdempotencyInterceptor)
  async cancel(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelReservationDto,
    @Headers('if-match') ifMatch: string,
  ): Promise<ReservationResponse> {
    const cancelled = await this.cancelReservation.execute(
      new CancelReservationCommand(
        id,
        req.firebaseUid!,
        dto.companyId,
        dto.branchId,
        parseVersionIfMatch(ifMatch),
        dto.reason,
        dto.note,
      ),
    );
    return toReservationResponse(cancelled);
  }

  @Post(':id/documents/upload-url')
  @UseInterceptors(IdempotencyInterceptor)
  @HttpCode(HttpStatus.CREATED)
  async requestDocumentUploadSessionEndpoint(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RequestReservationDocumentUploadSessionDto,
  ): Promise<{ uploadUrl: string; objectUrl: string }> {
    return this.requestDocumentUploadSession.execute({
      firebaseUid: req.firebaseUid!,
      companyId: dto.companyId,
      branchId: dto.branchId,
      reservationId: id,
      documentType: dto.documentType,
      contentType: dto.contentType,
      contentLength: dto.contentLength,
    });
  }

  @Post(':id/documents')
  @UseInterceptors(IdempotencyInterceptor)
  @HttpCode(HttpStatus.CREATED)
  async recordDocumentEndpoint(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordReservationDocumentDto,
  ): Promise<ReservationDocumentRecord> {
    return this.recordDocument.execute({
      firebaseUid: req.firebaseUid!,
      companyId: dto.companyId,
      branchId: dto.branchId,
      reservationId: id,
      documentType: dto.documentType,
      objectUrl: dto.objectUrl,
    });
  }

  @Get(':id/documents')
  async listDocumentsEndpoint(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyId: string,
    @Query('branchId') branchId: string,
  ): Promise<ReservationDocumentRecord[]> {
    return this.listDocuments.execute({
      firebaseUid: req.firebaseUid!,
      companyId,
      branchId,
      reservationId: id,
    });
  }
}
