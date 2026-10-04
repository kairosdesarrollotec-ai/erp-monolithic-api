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
import { ApproveNotaryExceptionHandler } from '../../application/commands/approve-notary-exception.handler';
import { ApproveNotaryExceptionCommand } from '../../application/commands/approve-notary-exception.command';
import { FormalizeContractHandler } from '../../application/commands/formalize-contract.handler';
import { FormalizeContractCommand } from '../../application/commands/formalize-contract.command';
import { CompleteDeliveryHandler } from '../../application/commands/complete-delivery.handler';
import { CompleteDeliveryCommand } from '../../application/commands/complete-delivery.command';
import { RequestEvidenceUploadSessionHandler } from '../../application/commands/request-evidence-upload-session.handler';
import { RequestEvidenceUploadSessionCommand } from '../../application/commands/request-evidence-upload-session.command';
import { RecordEvidenceHandler } from '../../application/commands/record-evidence.handler';
import { RecordEvidenceCommand } from '../../application/commands/record-evidence.command';
import { ListRentalEvidenceHandler } from '../../application/queries/list-rental-evidence.handler';
import { ListRentalEvidenceQuery } from '../../application/queries/list-rental-evidence.query';
import { RequestExtensionHandler } from '../../application/commands/request-extension.handler';
import { RequestExtensionCommand } from '../../application/commands/request-extension.command';
import { AuthorizeExtensionHandler } from '../../application/commands/authorize-extension.handler';
import { AuthorizeExtensionCommand } from '../../application/commands/authorize-extension.command';
import { RejectExtensionHandler } from '../../application/commands/reject-extension.handler';
import { RejectExtensionCommand } from '../../application/commands/reject-extension.command';
import { ReportExtensionBreachHandler } from '../../application/commands/report-extension-breach.handler';
import { ReportExtensionBreachCommand } from '../../application/commands/report-extension-breach.command';
import { GetRentalHandler } from '../../application/queries/get-rental.handler';
import { GetRentalQuery } from '../../application/queries/get-rental.query';
import { ListRentalsHandler } from '../../application/queries/list-rentals.handler';
import { ListRentalsQuery } from '../../application/queries/list-rentals.query';
import { CreateRentalDto } from './dto/create-rental.dto';
import { CreateRentalFromReservationDto } from './dto/create-rental-from-reservation.dto';
import { ValidateDocumentsDto } from './dto/validate-documents.dto';
import { RegisterAlcoholTestDto } from './dto/register-alcohol-test.dto';
import { CommandScopeDto } from './dto/command-scope.dto';
import { ApproveNotaryExceptionDto } from './dto/approve-notary-exception.dto';
import { FormalizeContractDto } from './dto/formalize-contract.dto';
import { CompleteDeliveryDto } from './dto/complete-delivery.dto';
import { RequestEvidenceUploadSessionDto } from './dto/request-evidence-upload-session.dto';
import { EvidenceUploadSessionResponse } from './dto/evidence-upload-session.response';
import { RecordEvidenceDto } from './dto/record-evidence.dto';
import { RentalEvidenceResponse } from './dto/rental-evidence.response';
import { RequestExtensionDto } from './dto/request-extension.dto';
import { AuthorizeExtensionDto } from './dto/authorize-extension.dto';
import { RejectExtensionDto } from './dto/reject-extension.dto';
import { ReportExtensionBreachDto } from './dto/report-extension-breach.dto';
import { ListRentalsQueryDto } from './dto/list-rentals-query.dto';
import { GetRentalQueryDto } from './dto/get-rental-query.dto';
import { RentalResponse } from './dto/rental.response';
import { toRentalResponse } from './rental.mapper';
import { RENTAL_LIST_MAX_LIMIT } from '../../domain/rental-pagination';
import { RequestRentalDocumentUploadSessionHandler } from '../../application/commands/request-rental-document-upload-session.handler';
import { RecordRentalDocumentHandler } from '../../application/commands/record-rental-document.handler';
import { ListRentalDocumentsHandler } from '../../application/queries/list-rental-documents.handler';
import { RequestRentalDocumentUploadSessionDto } from './dto/request-rental-document-upload-session.dto';
import { RecordRentalDocumentDto } from './dto/record-rental-document.dto';
import { ListDocumentsQueryDto } from './dto/list-documents-query.dto';
import { RentalDocumentRecord } from '../../application/ports/rental-document-repository.port';

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
    private readonly formalizeContract: FormalizeContractHandler,
    private readonly completeDelivery: CompleteDeliveryHandler,
    private readonly requestEvidenceUploadSession: RequestEvidenceUploadSessionHandler,
    private readonly recordEvidence: RecordEvidenceHandler,
    private readonly listRentalEvidence: ListRentalEvidenceHandler,
    private readonly requestExtension: RequestExtensionHandler,
    private readonly authorizeExtension: AuthorizeExtensionHandler,
    private readonly rejectExtension: RejectExtensionHandler,
    private readonly reportExtensionBreach: ReportExtensionBreachHandler,
    private readonly getRental: GetRentalHandler,
    private readonly listRentals: ListRentalsHandler,
    private readonly requestDocumentUploadSession: RequestRentalDocumentUploadSessionHandler,
    private readonly recordDocument: RecordRentalDocumentHandler,
    private readonly listDocuments: ListRentalDocumentsHandler,
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
        dto.startAt ? new Date(dto.startAt) : undefined,
        dto.expectedEndAt ? new Date(dto.expectedEndAt) : undefined,
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
        dto.identityDocumentValid !== undefined
          ? {
              identityDocumentValid: dto.identityDocumentValid,
              driverLicenseValid: dto.driverLicenseValid ?? false,
              addressOrStayProofValid: dto.addressOrStayProofValid ?? false,
              notes: dto.notes,
            }
          : undefined,
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
    @Body() dto: CommandScopeDto,
    @Headers('if-match') ifMatch: string,
  ) {
    const result = await this.evaluateNotary.execute(
      new EvaluateNotaryCommand(
        id,
        req.firebaseUid!,
        dto.companyId,
        dto.branchId,
        parseVersionIfMatch(ifMatch),
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

  @Post(':id/commands/formalize-contract')
  @HttpCode(200)
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
        dto.templateVersionId,
        dto.documentRef,
        dto.depositAmount,
        dto.depositCurrency,
        dto.signatureData,
      ),
    );
    return toRentalResponse(updated);
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

  @Post(':id/evidence/upload-url')
  @HttpCode(201)
  @UseInterceptors(IdempotencyInterceptor)
  async requestEvidenceUploadUrl(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RequestEvidenceUploadSessionDto,
  ): Promise<EvidenceUploadSessionResponse> {
    return this.requestEvidenceUploadSession.execute(
      new RequestEvidenceUploadSessionCommand(
        id,
        req.firebaseUid!,
        dto.companyId,
        dto.branchId,
        dto.type,
        dto.zone,
        dto.contentType,
        dto.contentLength,
      ),
    );
  }

  @Post(':id/evidence')
  @HttpCode(201)
  @UseInterceptors(IdempotencyInterceptor)
  async recordEvidenceCommand(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordEvidenceDto,
  ): Promise<RentalEvidenceResponse> {
    const record = await this.recordEvidence.execute(
      new RecordEvidenceCommand(id, req.firebaseUid!, dto.companyId, dto.branchId, dto.type, dto.zone, dto.objectUrl),
    );
    return {
      id: record.id,
      rentalId: record.rentalId,
      type: record.type,
      zone: record.zone,
      objectUrl: record.objectUrl,
      uploadedBy: record.uploadedBy,
      uploadedAt: record.uploadedAt.toISOString(),
    };
  }

  @Get(':id/evidence')
  async listEvidence(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId', ParseUUIDPipe) companyId: string,
    @Query('branchId', ParseUUIDPipe) branchId: string,
  ): Promise<RentalEvidenceResponse[]> {
    const records = await this.listRentalEvidence.execute(
      new ListRentalEvidenceQuery(id, req.firebaseUid!, companyId, branchId),
    );
    return records.map((record) => ({
      id: record.id,
      rentalId: record.rentalId,
      type: record.type,
      zone: record.zone,
      objectUrl: record.objectUrl,
      uploadedBy: record.uploadedBy,
      uploadedAt: record.uploadedAt.toISOString(),
    }));
  }

  @Post(':id/commands/request-extension')
  @HttpCode(200)
  @UseInterceptors(IdempotencyInterceptor)
  async requestExtensionCommand(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RequestExtensionDto,
    @Headers('if-match') ifMatch: string,
  ): Promise<RentalResponse> {
    const updated = await this.requestExtension.execute(
      new RequestExtensionCommand(
        id,
        req.firebaseUid!,
        dto.companyId,
        dto.branchId,
        parseVersionIfMatch(ifMatch),
        new Date(dto.requestedEndAt),
      ),
    );
    return toRentalResponse(updated);
  }

  @Post(':id/commands/authorize-extension')
  @HttpCode(200)
  @UseInterceptors(IdempotencyInterceptor)
  async authorizeExtensionCommand(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AuthorizeExtensionDto,
    @Headers('if-match') ifMatch: string,
  ): Promise<RentalResponse> {
    const updated = await this.authorizeExtension.execute(
      new AuthorizeExtensionCommand(
        id,
        req.firebaseUid!,
        dto.companyId,
        dto.branchId,
        parseVersionIfMatch(ifMatch),
        dto.paymentId,
        dto.addendumDocumentRef,
      ),
    );
    return toRentalResponse(updated);
  }

  @Post(':id/commands/reject-extension')
  @HttpCode(200)
  @UseInterceptors(IdempotencyInterceptor)
  async rejectExtensionCommand(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectExtensionDto,
    @Headers('if-match') ifMatch: string,
  ): Promise<RentalResponse> {
    const updated = await this.rejectExtension.execute(
      new RejectExtensionCommand(
        id,
        req.firebaseUid!,
        dto.companyId,
        dto.branchId,
        parseVersionIfMatch(ifMatch),
      ),
    );
    return toRentalResponse(updated);
  }

  @Post(':id/commands/report-extension-breach')
  @HttpCode(200)
  @UseInterceptors(IdempotencyInterceptor)
  async reportExtensionBreachCommand(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReportExtensionBreachDto,
    @Headers('if-match') ifMatch: string,
  ): Promise<RentalResponse> {
    const updated = await this.reportExtensionBreach.execute(
      new ReportExtensionBreachCommand(
        id,
        req.firebaseUid!,
        dto.companyId,
        dto.branchId,
        parseVersionIfMatch(ifMatch),
        dto.notes,
      ),
    );
    return toRentalResponse(updated);
  }

  @Post(':id/documents/upload-url')
  @HttpCode(HttpStatus.CREATED)
  async requestDocumentUploadSessionEndpoint(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RequestRentalDocumentUploadSessionDto,
  ): Promise<{ uploadUrl: string; objectUrl: string }> {
    return this.requestDocumentUploadSession.execute({
      firebaseUid: req.firebaseUid!,
      companyId: dto.companyId,
      branchId: dto.branchId,
      rentalId: id,
      documentType: dto.documentType,
      contentType: dto.contentType,
      contentLength: dto.contentLength,
    });
  }

  @Post(':id/documents')
  @HttpCode(HttpStatus.CREATED)
  async recordDocumentEndpoint(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordRentalDocumentDto,
  ): Promise<RentalDocumentRecord> {
    return this.recordDocument.execute({
      firebaseUid: req.firebaseUid!,
      companyId: dto.companyId,
      branchId: dto.branchId,
      rentalId: id,
      documentType: dto.documentType,
      objectUrl: dto.objectUrl,
    });
  }

  @Get(':id/documents')
  async listDocumentsEndpoint(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListDocumentsQueryDto,
  ): Promise<RentalDocumentRecord[]> {
    return this.listDocuments.execute({
      firebaseUid: req.firebaseUid!,
      companyId: query.companyId,
      branchId: query.branchId,
      rentalId: id,
    });
  }
}
