import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
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
import {
  RecentAuth,
  RecentAuthGuard,
} from '../../../users/infrastructure/auth/recent-auth.guard';
import { parseVersionIfMatch } from '../../../../common/http/etag';
import { IdempotencyInterceptor } from '../../../../common/http/idempotency.interceptor';
import { CreateRentalHandler } from '../../application/commands/create-rental.handler';
import { CreateRentalCommand } from '../../application/commands/create-rental.command';
import { CreateRentalFromReservationHandler } from '../../application/commands/create-rental-from-reservation.handler';
import { CreateRentalFromReservationCommand } from '../../application/commands/create-rental-from-reservation.command';
import { ValidateDocumentsHandler } from '../../application/commands/validate-documents.handler';
import { ValidateDocumentsCommand } from '../../application/commands/validate-documents.command';
import { RegisterAlcoholTestHandler } from '../../application/commands/register-alcohol-test.handler';
import { RegisterAlcoholTestCommand } from '../../application/commands/register-alcohol-test.command';
import { EvaluateNotaryHandler } from '../../application/commands/evaluate-notary.handler';
import { EvaluateNotaryCommand } from '../../application/commands/evaluate-notary.command';
import { RegisterAuthorizedDriverHandler } from '../../application/commands/register-authorized-driver.handler';
import { RegisterAuthorizedDriverCommand } from '../../application/commands/register-authorized-driver.command';
import { RegisterAuthorizedDriverDto } from './dto/register-authorized-driver.dto';
import { RegisterCompanionHandler } from '../../application/commands/register-companion.handler';
import { RegisterCompanionCommand } from '../../application/commands/register-companion.command';
import { RegisterCompanionDto } from './dto/register-companion.dto';
import { SetCompanyDriverDailyRateHandler } from '../../application/commands/set-company-driver-daily-rate.handler';
import { SetCompanyDriverDailyRateCommand } from '../../application/commands/set-company-driver-daily-rate.command';
import { SetCompanyDriverDailyRateDto } from './dto/set-company-driver-daily-rate.dto';
import { ApproveNotaryExceptionHandler } from '../../application/commands/approve-notary-exception.handler';
import { ApproveNotaryExceptionCommand } from '../../application/commands/approve-notary-exception.command';
import { FormalizeContractHandler } from '../../application/commands/formalize-contract.handler';
import { FormalizeContractCommand } from '../../application/commands/formalize-contract.command';
import { CompleteDeliveryHandler } from '../../application/commands/complete-delivery.handler';
import { CompleteDeliveryCommand } from '../../application/commands/complete-delivery.command';
import { CancelRentalHandler } from '../../application/commands/cancel-rental.handler';
import { CancelRentalCommand } from '../../application/commands/cancel-rental.command';
import { CancelRentalDto } from './dto/cancel-rental.dto';
import { GetRentalHandler } from '../../application/queries/get-rental.handler';
import { GetRentalQuery } from '../../application/queries/get-rental.query';
import { GetContractTemplateHandler } from '../../application/queries/get-contract-template.handler';
import { GetContractTemplateQuery } from '../../application/queries/get-contract-template.query';
import { ListRentalsHandler } from '../../application/queries/list-rentals.handler';
import { ListRentalsQuery } from '../../application/queries/list-rentals.query';
import { CreateRentalDto } from './dto/create-rental.dto';
import { CreateRentalFromReservationDto } from './dto/create-rental-from-reservation.dto';
import { ValidateDocumentsDto } from './dto/validate-documents.dto';
import { RegisterAlcoholTestDto } from './dto/register-alcohol-test.dto';
import { EvaluateNotaryDto } from './dto/evaluate-notary.dto';
import { ApproveNotaryExceptionDto } from './dto/approve-notary-exception.dto';
import { FormalizeContractDto } from './dto/formalize-contract.dto';
import { CompleteDeliveryDto } from './dto/complete-delivery.dto';
import { ListRentalsQueryDto } from './dto/list-rentals-query.dto';
import { GetRentalQueryDto } from './dto/get-rental-query.dto';
import { GetContractTemplateQueryDto } from './dto/get-contract-template-query.dto';
import { ContractTemplateSelectionResponse } from './dto/contract-template-selection.response';
import { RentalResponse } from './dto/rental.response';
import { toRentalResponse } from './rental.mapper';
import { RENTAL_LIST_MAX_LIMIT } from '../../domain/rental-pagination';
import { resolveWithCompanyDriver } from '../../domain/contract-variant';
import { parseBusinessInstant } from '../../../../common/time/lima-time';

@Controller('rentals')
@UseGuards(FirebaseAuthGuard)
export class RentalsController {
  constructor(
    private readonly createRental: CreateRentalHandler,
    private readonly createRentalFromReservation: CreateRentalFromReservationHandler,
    private readonly validateDocuments: ValidateDocumentsHandler,
    private readonly registerAlcoholTest: RegisterAlcoholTestHandler,
    private readonly evaluateNotary: EvaluateNotaryHandler,
    private readonly approveNotaryException: ApproveNotaryExceptionHandler,
    private readonly registerAuthorizedDriver: RegisterAuthorizedDriverHandler,
    private readonly registerCompanion: RegisterCompanionHandler,
    private readonly setCompanyDriverDailyRate: SetCompanyDriverDailyRateHandler,
    private readonly formalizeContract: FormalizeContractHandler,
    private readonly completeDelivery: CompleteDeliveryHandler,
    private readonly cancelRental: CancelRentalHandler,
    private readonly getRental: GetRentalHandler,
    private readonly listRentals: ListRentalsHandler,
    private readonly getContractTemplate: GetContractTemplateHandler,
  ) {}

  @Post()
  @UseInterceptors(IdempotencyInterceptor)
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateRentalDto,
  ): Promise<RentalResponse> {
    const created = await this.createRental.execute(
      new CreateRentalCommand(
        req.firebaseUid!,
        dto.companyId,
        dto.branchId,
        dto.customerId,
        dto.vehicleId,
        dto.planCode,
        dto.startAt ? parseBusinessInstant(dto.startAt) : undefined,
        dto.expectedEndAt ? parseBusinessInstant(dto.expectedEndAt) : undefined,
        dto.inquiryId,
      ),
    );
    return toRentalResponse(created);
  }

  @Post('from-reservation/:reservationId')
  @UseInterceptors(IdempotencyInterceptor)
  async createFromReservation(
    @Req() req: AuthenticatedRequest,
    @Param('reservationId', ParseUUIDPipe) reservationId: string,
    @Body() dto: CreateRentalFromReservationDto,
  ): Promise<RentalResponse> {
    const created = await this.createRentalFromReservation.execute(
      new CreateRentalFromReservationCommand(
        req.firebaseUid!,
        dto.companyId,
        dto.branchId,
        reservationId,
        dto.planCode,
      ),
    );
    return toRentalResponse(created);
  }

  @Get()
  async list(
    @Req() req: AuthenticatedRequest,
    @Query() query: ListRentalsQueryDto,
  ): Promise<RentalResponse[]> {
    const MAX_LIMIT = RENTAL_LIST_MAX_LIMIT;
    const requestedLimit = query.limit ? Number(query.limit) : undefined;
    if (requestedLimit !== undefined && requestedLimit > MAX_LIMIT) {
      throw new BadRequestException(`limit no puede ser mayor a ${MAX_LIMIT}.`);
    }

    let cursor: { createdAt: Date; id: string } | undefined;
    if (query.cursorCreatedAt || query.cursorId) {
      if (!query.cursorCreatedAt || !query.cursorId) {
        throw new BadRequestException(
          'cursorCreatedAt y cursorId deben enviarse juntos para paginar.',
        );
      }
      cursor = { createdAt: new Date(query.cursorCreatedAt), id: query.cursorId };
    }

    const results = await this.listRentals.execute(
      new ListRentalsQuery(
        req.firebaseUid!,
        query.companyId,
        query.branchId,
        query.status,
        requestedLimit ?? 20,
        cursor,
      ),
    );

    return results.map(toRentalResponse);
  }

  @Get(':id')
  async detail(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: GetRentalQueryDto,
  ): Promise<RentalResponse> {
    const rental = await this.getRental.execute(
      new GetRentalQuery(id, req.firebaseUid!, query.companyId, query.branchId),
    );
    return toRentalResponse(rental);
  }

  /**
   * BR-DOC-002/003 (ENTREGA-03): plantilla de contrato vigente que corresponde
   * a la combinacion titular natural/juridica x con/sin conductor.
   */
  @Get(':id/contract-template')
  async contractTemplate(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: GetContractTemplateQueryDto,
  ): Promise<ContractTemplateSelectionResponse> {
    const variant = query.holderType
      ? {
          holderType: query.holderType,
          withCompanyDriver:
            resolveWithCompanyDriver({
              withCompanyDriver: query.withCompanyDriver === undefined ? undefined : query.withCompanyDriver === 'true',
              withDriver: query.withDriver === undefined ? undefined : query.withDriver === 'true',
            }) === true,
        }
      : undefined;
    const selection = await this.getContractTemplate.execute(
      new GetContractTemplateQuery(id, req.firebaseUid!, query.companyId, query.branchId, variant),
    );
    return {
      rentalId: selection.rentalId,
      variant: selection.variant
        ? { ...selection.variant, withDriver: selection.variant.withCompanyDriver }
        : null,
      requestedType: selection.requestedType,
      fallbackUsed: selection.fallbackUsed,
      template: selection.template
        ? {
            ...selection.template,
            effectiveFrom: selection.template.effectiveFrom ? selection.template.effectiveFrom.toISOString() : null,
          }
        : null,
    };
  }

  @Post(':id/commands/validate-documents')
  @HttpCode(200)
  @UseInterceptors(IdempotencyInterceptor)
  async validateDocumentsCommand(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ValidateDocumentsDto,
    @Headers('if-match') ifMatch: string,
  ): Promise<RentalResponse> {
    const updated = await this.validateDocuments.execute(
      new ValidateDocumentsCommand(
        id,
        req.firebaseUid!,
        dto.companyId,
        dto.branchId,
        parseVersionIfMatch(ifMatch),
        {
          identityDocumentValid: dto.identityDocumentValid ?? false,
          passportValid: dto.passportValid ?? false,
          foreignerCardValid: dto.foreignerCardValid ?? false,
          driverLicenseValid: dto.driverLicenseValid ?? false,
          addressOrStayProofValid: dto.addressOrStayProofValid ?? false,
          notes: dto.notes,
        },
      ),
    );
    return toRentalResponse(updated);
  }

  @Post(':id/commands/register-alcohol-test')
  @HttpCode(200)
  @UseInterceptors(IdempotencyInterceptor)
  async registerAlcoholTestCommand(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RegisterAlcoholTestDto,
    @Headers('if-match') ifMatch: string,
  ): Promise<RentalResponse> {
    const updated = await this.registerAlcoholTest.execute(
      new RegisterAlcoholTestCommand(
        id,
        req.firebaseUid!,
        dto.companyId,
        dto.branchId,
        parseVersionIfMatch(ifMatch),
        dto.result,
        dto.notes,
      ),
    );
    return toRentalResponse(updated);
  }

  @Post(':id/commands/evaluate-notary')
  @HttpCode(200)
  @UseInterceptors(IdempotencyInterceptor)
  async evaluateNotaryCommand(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EvaluateNotaryDto,
    @Headers('if-match') ifMatch: string,
  ) {
    const result = await this.evaluateNotary.execute(
      new EvaluateNotaryCommand(
        id,
        req.firebaseUid!,
        dto.companyId,
        dto.branchId,
        parseVersionIfMatch(ifMatch),
        dto.biometricVerified === true,
      ),
    );
    return {
      rental: toRentalResponse(result.rental),
      evaluation: result.evaluation,
    };
  }

  @Post(':id/commands/approve-notary-exception')
  @HttpCode(200)
  @UseInterceptors(IdempotencyInterceptor)
  async approveNotaryExceptionCommand(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveNotaryExceptionDto,
    @Headers('if-match') ifMatch: string,
  ): Promise<RentalResponse> {
    const updated = await this.approveNotaryException.execute(
      new ApproveNotaryExceptionCommand(
        id,
        req.firebaseUid!,
        dto.companyId,
        dto.branchId,
        parseVersionIfMatch(ifMatch),
        dto.justification,
      ),
    );
    return toRentalResponse(updated);
  }

  /** DEC-ALQ-OWN-DRIVER-005: conductor propio autorizado (persona juridica) con su adenda. */
  @Post(':id/commands/register-authorized-driver')
  @HttpCode(200)
  @UseInterceptors(IdempotencyInterceptor)
  async registerAuthorizedDriverCommand(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RegisterAuthorizedDriverDto,
    @Headers('if-match') ifMatch: string,
  ): Promise<RentalResponse> {
    const updated = await this.registerAuthorizedDriver.execute(
      new RegisterAuthorizedDriverCommand(
        id,
        req.firebaseUid!,
        dto.companyId,
        dto.branchId,
        parseVersionIfMatch(ifMatch),
        dto.driverCustomerId,
        dto.addendumDocumentRef,
        dto.holderType,
      ),
    );
    return toRentalResponse(updated);
  }

  /** DEC-ALQ-COMPANION-006: acompanante autorizado (persona natural) que firma como responsable. */
  @Post(':id/commands/register-companion')
  @HttpCode(200)
  @UseInterceptors(IdempotencyInterceptor)
  async registerCompanionCommand(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RegisterCompanionDto,
    @Headers('if-match') ifMatch: string,
  ): Promise<RentalResponse> {
    const updated = await this.registerCompanion.execute(
      new RegisterCompanionCommand(
        id,
        req.firebaseUid!,
        dto.companyId,
        dto.branchId,
        parseVersionIfMatch(ifMatch),
        dto.companionCustomerId,
        dto.driverCustomerId,
        dto.companionLicenseVerified,
        dto.driverLicenseVerified,
        dto.reason,
        dto.addendumDocumentRef,
        dto.holderType,
      ),
    );
    return toRentalResponse(updated);
  }

  /** DEC-ALQ-DRIVERRATE-001: tarifa diaria manual del conductor de la empresa (prioridad sobre el env). */
  @Post(':id/commands/set-company-driver-daily-rate')
  @HttpCode(200)
  @UseInterceptors(IdempotencyInterceptor)
  async setCompanyDriverDailyRateCommand(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetCompanyDriverDailyRateDto,
    @Headers('if-match') ifMatch: string,
  ): Promise<RentalResponse> {
    const updated = await this.setCompanyDriverDailyRate.execute(
      new SetCompanyDriverDailyRateCommand(
        id,
        req.firebaseUid!,
        dto.companyId,
        dto.branchId,
        parseVersionIfMatch(ifMatch),
        dto.dailyRate,
      ),
    );
    return toRentalResponse(updated);
  }

  @Post(':id/commands/formalize-contract')
  @HttpCode(200)
  @UseGuards(RecentAuthGuard)
  @RecentAuth(300)
  @UseInterceptors(IdempotencyInterceptor)
  async formalizeContractCommand(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: FormalizeContractDto,
    @Headers('if-match') ifMatch: string,
  ): Promise<RentalResponse> {
    const updated = await this.formalizeContract.execute(
      new FormalizeContractCommand(
        id,
        req.firebaseUid!,
        dto.companyId,
        dto.branchId,
        parseVersionIfMatch(ifMatch),
        dto.documentRef,
        dto.depositAmount,
        dto.depositCurrency,
        dto.signatureData,
        dto.holderType
          ? { holderType: dto.holderType, withCompanyDriver: resolveWithCompanyDriver(dto) === true }
          : undefined,
        dto.payment
          ? {
              method: dto.payment.method,
              operationNumber: dto.payment.operationNumber,
              payerName: dto.payment.payerName,
              payerDocumentNumber: dto.payment.payerDocumentNumber,
              payerIsExternalAgent: dto.payment.payerIsExternalAgent,
              externalAgentVerified: dto.payment.externalAgentVerified === true,
              voucherDocumentId: dto.payment.voucherDocumentId,
            }
          : undefined,
      ),
    );
    return toRentalResponse(updated);
  }

  /**
   * DEC-ALQ-CANCEL-001: cancela el alquiler antes de la entrega (motivo obligatorio: DOCUMENTS_INVALID,
   * CUSTOMER_REJECTED_NOTARY u OTHER con nota). Libera el compromiso del vehiculo.
   */
  @Post(':id/commands/cancel')
  @HttpCode(200)
  @UseInterceptors(IdempotencyInterceptor)
  async cancelCommand(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelRentalDto,
    @Headers('if-match') ifMatch: string,
  ): Promise<RentalResponse> {
    const cancelled = await this.cancelRental.execute(
      new CancelRentalCommand(
        id,
        req.firebaseUid!,
        dto.companyId,
        dto.branchId,
        parseVersionIfMatch(ifMatch),
        dto.reason,
        dto.note,
      ),
    );
    return toRentalResponse(cancelled);
  }

  @Post(':id/commands/complete-delivery')
  @HttpCode(200)
  @UseInterceptors(IdempotencyInterceptor)
  async completeDeliveryCommand(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CompleteDeliveryDto,
    @Headers('if-match') ifMatch: string,
  ): Promise<RentalResponse> {
    const updated = await this.completeDelivery.execute(
      new CompleteDeliveryCommand(
        id,
        req.firebaseUid!,
        dto.companyId,
        dto.branchId,
        parseVersionIfMatch(ifMatch),
        dto.photosCount,
        dto.videosCount,
        dto.notes,
      ),
    );
    return toRentalResponse(updated);
  }

}

