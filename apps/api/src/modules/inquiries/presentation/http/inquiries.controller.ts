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
import { AuthenticatedRequest, FirebaseAuthGuard } from '../../../users/infrastructure/auth/firebase-auth.guard';
import { parseVersionIfMatch } from '../../../../common/http/etag';
import { IdempotencyInterceptor } from '../../../../common/http/idempotency.interceptor';
import { RegisterInquiryHandler } from '../../application/commands/register-inquiry.handler';
import { RegisterInquiryCommand } from '../../application/commands/register-inquiry.command';
import { QuoteHandler } from '../../application/commands/quote.handler';
import { QuoteCommand } from '../../application/commands/quote.command';
import { CloseInquiryHandler } from '../../application/commands/close-inquiry.handler';
import { CloseInquiryCommand } from '../../application/commands/close-inquiry.command';
import { ConvertToReservationHandler } from '../../application/commands/convert-to-reservation.handler';
import { ConvertToReservationCommand } from '../../application/commands/convert-to-reservation.command';
import { ConvertToRentalHandler } from '../../application/commands/convert-to-rental.handler';
import { ConvertToRentalCommand } from '../../application/commands/convert-to-rental.command';
import { GetInquiryHandler } from '../../application/queries/get-inquiry.handler';
import { GetInquiryQuery } from '../../application/queries/get-inquiry.query';
import { ListInquiriesHandler } from '../../application/queries/list-inquiries.handler';
import { ListInquiriesQuery } from '../../application/queries/list-inquiries.query';
import { INQUIRY_LIST_DEFAULT_LIMIT } from '../../domain/inquiry-pagination';
import { RegisterInquiryDto } from './dto/register-inquiry.dto';
import { QuoteDto } from './dto/quote.dto';
import { CloseInquiryDto } from './dto/close-inquiry.dto';
import { ConvertToReservationDto } from './dto/convert-to-reservation.dto';
import { ConvertToRentalDto } from './dto/convert-to-rental.dto';
import { ListInquiriesQueryDto } from './dto/list-inquiries-query.dto';
import { GetInquiryQueryDto } from './dto/get-inquiry-query.dto';
import { InquiryResponse, InquirySummaryResponse } from './dto/inquiry.response';
import { ConvertToReservationResponse } from './dto/convert-to-reservation.response';
import { ConvertToRentalResponse } from './dto/convert-to-rental.response';
import { toInquiryResponse, toInquirySummaryResponse } from './inquiry.mapper';
import { toReservationResponse } from '../../../reservations/presentation/http/reservation.mapper';
import { toRentalResponse } from '../../../rentals/presentation/http/rental.mapper';

function toUtcDate(dateOnly: string | undefined): Date | undefined {
  return dateOnly ? new Date(`${dateOnly}T00:00:00.000Z`) : undefined;
}

/**
 * TDD-CON-001.md seccion 11 - contrato HTTP de Consulta (HU-26), definido en
 * packages/contracts/openapi/inquiries.yaml. No expone `PATCH status`.
 *
 * Revalidacion PR#7 (d7a6124):
 * - ALTO "idempotencia": `IdempotencyInterceptor` (reserva atomica de la
 *   clave, ver common/http) en los 4 comandos - register, quote, close
 *   (TDD-CON-001.md 15) y convert-to-reservation (crea una Reserva: un
 *   reintento nunca debe crear una segunda).
 * - MEDIO "validacion HTTP": ParseUUIDPipe en `:id` y DTO con @IsUUID()
 *   para companyId/branchId del detalle; `limit` maximo 100 en el handler.
 */
@Controller('inquiries')
@UseGuards(FirebaseAuthGuard)
export class InquiriesController {
  constructor(
    private readonly registerInquiry: RegisterInquiryHandler,
    private readonly quote: QuoteHandler,
    private readonly closeInquiry: CloseInquiryHandler,
    private readonly convertToReservation: ConvertToReservationHandler,
    private readonly convertToRental: ConvertToRentalHandler,
    private readonly getInquiry: GetInquiryHandler,
    private readonly listInquiries: ListInquiriesHandler,
  ) {}

  @Post()
  @UseInterceptors(IdempotencyInterceptor)
  async register(@Req() req: AuthenticatedRequest, @Body() dto: RegisterInquiryDto): Promise<InquiryResponse> {
    const created = await this.registerInquiry.execute(
      new RegisterInquiryCommand(
        req.firebaseUid!,
        dto.companyId,
        dto.branchId,
        dto.channel,
        dto.touristUse,
        {
          destination: dto.destination,
          estimatedDays: dto.estimatedDays,
          travelStartDate: toUtcDate(dto.travelStartDate),
          partySize: dto.partySize,
        },
        dto.customerId,
        dto.prospect
          ? {
              fullName: dto.prospect.fullName,
              documentType: dto.prospect.documentType,
              documentNumber: dto.prospect.documentNumber,
              nationality: dto.prospect.nationality,
              countryEntryDate: toUtcDate(dto.prospect.countryEntryDate),
            }
          : undefined,
      ),
    );
    return toInquiryResponse(created);
  }

  @Get()
  async list(
    @Req() req: AuthenticatedRequest,
    @Query() query: ListInquiriesQueryDto,
  ): Promise<InquirySummaryResponse[]> {
    let cursor: { createdAt: Date; id: string } | undefined;
    if (query.cursorCreatedAt || query.cursorId) {
      if (!query.cursorCreatedAt || !query.cursorId) {
        throw new BadRequestException('cursorCreatedAt y cursorId deben enviarse juntos para paginar.');
      }
      cursor = { createdAt: new Date(query.cursorCreatedAt), id: query.cursorId };
    }

    const results = await this.listInquiries.execute(
      new ListInquiriesQuery(
        req.firebaseUid!,
        query.companyId,
        query.branchId,
        query.status,
        query.channel,
        query.customerId,
        query.createdFrom ? new Date(query.createdFrom) : undefined,
        query.createdTo ? new Date(query.createdTo) : undefined,
        query.limit ? Number(query.limit) : INQUIRY_LIST_DEFAULT_LIMIT,
        cursor,
      ),
    );
    return results.map(toInquirySummaryResponse);
  }

  @Get(':id')
  async detail(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: GetInquiryQueryDto,
  ): Promise<InquiryResponse> {
    const inquiry = await this.getInquiry.execute(new GetInquiryQuery(id, req.firebaseUid!, query.companyId, query.branchId));
    return toInquiryResponse(inquiry);
  }

  @Post(':id/commands/quote')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(IdempotencyInterceptor)
  async quoteCommand(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: QuoteDto,
    @Headers('if-match') ifMatch: string,
  ): Promise<InquiryResponse> {
    const updated = await this.quote.execute(
      new QuoteCommand(
        id,
        req.firebaseUid!,
        dto.companyId,
        dto.branchId,
        parseVersionIfMatch(ifMatch),
        dto.vehicleId,
        dto.destination,
        dto.estimatedDays,
      ),
    );
    return toInquiryResponse(updated);
  }

  @Post(':id/commands/close')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(IdempotencyInterceptor)
  async closeCommand(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CloseInquiryDto,
    @Headers('if-match') ifMatch: string,
  ): Promise<InquiryResponse> {
    const closed = await this.closeInquiry.execute(
      new CloseInquiryCommand(
        id,
        req.firebaseUid!,
        dto.companyId,
        dto.branchId,
        parseVersionIfMatch(ifMatch),
        dto.reason,
        dto.note,
      ),
    );
    return toInquiryResponse(closed);
  }

  @Post(':id/commands/convert-to-reservation')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(IdempotencyInterceptor)
  async convertToReservationCommand(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConvertToReservationDto,
    @Headers('if-match') ifMatch: string,
  ): Promise<ConvertToReservationResponse> {
    const result = await this.convertToReservation.execute(
      new ConvertToReservationCommand(
        id,
        req.firebaseUid!,
        dto.companyId,
        dto.branchId,
        parseVersionIfMatch(ifMatch),
        dto.channelMode,
        new Date(dto.startAt),
      ),
    );
    return {
      inquiry: toInquiryResponse(result.inquiry),
      reservation: toReservationResponse(result.reservation),
    };
  }

  @Post(':id/commands/convert-to-rental')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(IdempotencyInterceptor)
  async convertToRentalCommand(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConvertToRentalDto,
    @Headers('if-match') ifMatch: string,
  ): Promise<ConvertToRentalResponse> {
    const result = await this.convertToRental.execute(
      new ConvertToRentalCommand(
        id,
        req.firebaseUid!,
        dto.companyId,
        dto.branchId,
        parseVersionIfMatch(ifMatch),
        dto.planCode,
      ),
    );
    return {
      inquiry: toInquiryResponse(result.inquiry),
      rental: toRentalResponse(result.rental),
    };
  }
}
