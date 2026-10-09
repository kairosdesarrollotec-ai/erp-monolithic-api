import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
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
import { RequestExtensionHandler } from '../../application/commands/request-extension.handler';
import { RequestExtensionCommand } from '../../application/commands/request-extension.command';
import { AuthorizeExtensionHandler } from '../../application/commands/authorize-extension.handler';
import { AuthorizeExtensionCommand } from '../../application/commands/authorize-extension.command';
import { RejectExtensionHandler } from '../../application/commands/reject-extension.handler';
import { RejectExtensionCommand } from '../../application/commands/reject-extension.command';
import { ReportExtensionBreachHandler } from '../../application/commands/report-extension-breach.handler';
import { ReportExtensionBreachCommand } from '../../application/commands/report-extension-breach.command';
import { RequestExtensionDto } from './dto/request-extension.dto';
import { AuthorizeExtensionDto } from './dto/authorize-extension.dto';
import { RejectExtensionDto } from './dto/reject-extension.dto';
import { ReportExtensionBreachDto } from './dto/report-extension-breach.dto';
import { RentalResponse } from './dto/rental.response';
import { toRentalResponse } from './rental.mapper';

@Controller('rentals')
@UseGuards(FirebaseAuthGuard)
export class RentalsExtensionsController {
  constructor(
    private readonly requestExtension: RequestExtensionHandler,
    private readonly authorizeExtension: AuthorizeExtensionHandler,
    private readonly rejectExtension: RejectExtensionHandler,
    private readonly reportExtensionBreach: ReportExtensionBreachHandler,
  ) {}

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
}
