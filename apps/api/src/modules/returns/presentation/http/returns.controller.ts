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
import { parseVersionIfMatch } from '../../../../common/http/etag';
import { IdempotencyInterceptor } from '../../../../common/http/idempotency.interceptor';
import { CreateReturnHandler } from '../../application/commands/create-return.handler';
import { CreateReturnCommand } from '../../application/commands/create-return.command';
import { ReceiveProvisionalHandler } from '../../application/commands/receive-provisional.handler';
import { ReceiveProvisionalCommand } from '../../application/commands/receive-provisional.command';
import { RegisterReturnAlcoholTestHandler } from '../../application/commands/register-alcohol-test.handler';
import { RegisterReturnAlcoholTestCommand } from '../../application/commands/register-alcohol-test.command';
import { ResolveAlcoholEscalationHandler } from '../../application/commands/resolve-alcohol-escalation.handler';
import { ResolveAlcoholEscalationCommand } from '../../application/commands/resolve-alcohol-escalation.command';
import { CompleteInspectionHandler } from '../../application/commands/complete-inspection.handler';
import { CompleteInspectionCommand } from '../../application/commands/complete-inspection.command';
import { AssessDamageHandler } from '../../application/commands/assess-damage.handler';
import { AssessDamageCommand } from '../../application/commands/assess-damage.command';
import { ChargeImmobilizationHandler } from '../../application/commands/charge-immobilization.handler';
import { ChargeImmobilizationCommand } from '../../application/commands/charge-immobilization.command';
import { CloseFinancialHandler } from '../../application/commands/close-financial.handler';
import { CloseFinancialCommand } from '../../application/commands/close-financial.command';
import { CloseReturnHandler } from '../../application/commands/close-return.handler';
import { CloseReturnCommand } from '../../application/commands/close-return.command';
import { GetReturnHandler } from '../../application/queries/get-return.handler';
import { GetReturnQuery } from '../../application/queries/get-return.query';
import { GetCosmeticTariffHandler } from '../../application/queries/get-cosmetic-tariff.handler';
import { GetCosmeticTariffQuery } from '../../application/queries/get-cosmetic-tariff.query';
import { ListReturnsHandler } from '../../application/queries/list-returns.handler';
import { ListReturnsQuery } from '../../application/queries/list-returns.query';
import { GetResponsibilityTemplateHandler } from '../../application/queries/get-responsibility-template.handler';
import { GetResponsibilityTemplateQuery } from '../../application/queries/get-responsibility-template.query';
import { RegisterReturnReminderHandler } from '../../application/commands/register-return-reminder.handler';
import { RegisterReturnReminderCommand } from '../../application/commands/register-return-reminder.command';
import { ListReturnRemindersHandler } from '../../application/queries/list-return-reminders.handler';
import {
  ListReturnRemindersQuery,
  RETURN_REMINDER_LIST_DEFAULT_LIMIT,
  RETURN_REMINDER_LIST_MAX_LIMIT,
} from '../../application/queries/list-return-reminders.query';
import { ListReturnAlertsHandler } from '../../application/queries/list-return-alerts.handler';
import {
  ListReturnAlertsQuery,
  RETURN_ALERT_LIST_DEFAULT_LIMIT,
  RETURN_ALERT_LIST_MAX_LIMIT,
} from '../../application/queries/list-return-alerts.query';
import { RETURN_LIST_DEFAULT_LIMIT, RETURN_LIST_MAX_LIMIT } from '../../domain/return-pagination';
import { ScheduleReturnDto } from './dto/schedule-return.dto';
import { ReceiveProvisionalDto } from './dto/receive-provisional.dto';
import { RegisterReturnAlcoholTestDto } from './dto/register-return-alcohol-test.dto';
import { ResolveAlcoholEscalationDto } from './dto/resolve-alcohol-escalation.dto';
import { CompleteInspectionDto } from './dto/complete-inspection.dto';
import { AssessDamageDto } from './dto/assess-damage.dto';
import { ChargeImmobilizationDto } from './dto/charge-immobilization.dto';
import { CloseFinancialDto } from './dto/close-financial.dto';
import { CloseReturnDto } from './dto/close-return.dto';
import { RegisterReturnReminderDto } from './dto/register-return-reminder.dto';
import { ListReturnRemindersQueryDto } from './dto/list-return-reminders-query.dto';
import { ListReturnAlertsQueryDto } from './dto/list-return-alerts-query.dto';
import { ListReturnsQueryDto } from './dto/list-returns-query.dto';
import { ReturnScopeQueryDto } from './dto/return-scope-query.dto';
import {
  CosmeticTariffResponse,
  ImmobilizationChargeResponse,
  ReturnDamageResponse,
  ReturnResponse,
  ReturnAlertItemResponse,
  ReturnReminderInboxItemResponse,
  ReturnReminderResponse,
} from './dto/return.response';
import {
  toCosmeticTariffResponse,
  toImmobilizationChargeResponse,
  toReturnDamageResponse,
  toReturnResponse,
  toReturnAlertItemResponse,
  toReminderInboxItemResponse,
  toReturnReminderResponse,
} from './return.mapper';
import { ResponsibilityTemplateResponse, toResponsibilityTemplateResponse } from './dto/responsibility-template.response';
import { parseBusinessInstant } from '../../../../common/time/lima-time';

/**
 * Devolución (DEV-01..10) - contrato: packages/contracts/openapi/returns.yaml.
 * Todos los POST aceptan `Idempotency-Key` (opcional) y los comandos mutables exigen `If-Match: "<version>"`.
 */
@Controller('returns')
@UseGuards(FirebaseAuthGuard)
export class ReturnsController {
  constructor(
    private readonly createReturn: CreateReturnHandler,
    private readonly receiveProvisional: ReceiveProvisionalHandler,
    private readonly registerAlcoholTest: RegisterReturnAlcoholTestHandler,
    private readonly resolveAlcoholEscalation: ResolveAlcoholEscalationHandler,
    private readonly completeInspection: CompleteInspectionHandler,
    private readonly assessDamage: AssessDamageHandler,
    private readonly chargeImmobilization: ChargeImmobilizationHandler,
    private readonly closeFinancial: CloseFinancialHandler,
    private readonly closeReturn: CloseReturnHandler,
    private readonly getReturn: GetReturnHandler,
    private readonly getCosmeticTariff: GetCosmeticTariffHandler,
    private readonly listReturns: ListReturnsHandler,
    private readonly getResponsibilityTemplate: GetResponsibilityTemplateHandler,
    private readonly registerReminder: RegisterReturnReminderHandler,
    private readonly listReminders: ListReturnRemindersHandler,
    private readonly listAlerts: ListReturnAlertsHandler,
  ) {}

  @Post()
  @UseInterceptors(IdempotencyInterceptor)
  async create(@Req() req: AuthenticatedRequest, @Body() dto: ScheduleReturnDto): Promise<ReturnResponse> {
    const created = await this.createReturn.execute(
      new CreateReturnCommand(
        req.firebaseUid!,
        dto.companyId,
        dto.branchId,
        dto.rentalId,
        parseBusinessInstant(dto.scheduledAt),
        dto.notes,
      ),
    );
    return toReturnResponse(created);
  }

  @Get()
  async list(@Req() req: AuthenticatedRequest, @Query() query: ListReturnsQueryDto): Promise<ReturnResponse[]> {
    const requestedLimit = query.limit ? Number(query.limit) : undefined;
    if (requestedLimit !== undefined && requestedLimit > RETURN_LIST_MAX_LIMIT) {
      throw new BadRequestException(`limit no puede ser mayor a ${RETURN_LIST_MAX_LIMIT}.`);
    }

    let cursor: { createdAt: Date; id: string } | undefined;
    if (query.cursorCreatedAt || query.cursorId) {
      if (!query.cursorCreatedAt || !query.cursorId) {
        throw new BadRequestException('cursorCreatedAt y cursorId deben enviarse juntos para paginar.');
      }
      cursor = { createdAt: new Date(query.cursorCreatedAt), id: query.cursorId };
    }

    const results = await this.listReturns.execute(
      new ListReturnsQuery(
        req.firebaseUid!,
        query.companyId,
        query.branchId,
        query.status,
        requestedLimit ?? RETURN_LIST_DEFAULT_LIMIT,
        cursor,
      ),
    );
    return results.map(toReturnResponse);
  }

  @Post('receive-provisional')
  @UseInterceptors(IdempotencyInterceptor)
  async receiveProvisionalCommand(
    @Req() req: AuthenticatedRequest,
    @Body() dto: ReceiveProvisionalDto,
  ): Promise<ReturnResponse> {
    const received = await this.receiveProvisional.execute(
      new ReceiveProvisionalCommand(
        req.firebaseUid!,
        dto.companyId,
        dto.branchId,
        dto.rentalId,
        dto.mileageAtReturn,
        dto.fuelLevelAtReturn,
        dto.customerPresent,
        dto.notes,
      ),
    );
    return toReturnResponse(received);
  }

  /** BR-DEV-004 (DEV-01): bandeja de recordatorios pendientes de envío / fallidos. Antes de `:id`. */
  @Get('reminders')
  async reminders(
    @Req() req: AuthenticatedRequest,
    @Query() query: ListReturnRemindersQueryDto,
  ): Promise<ReturnReminderInboxItemResponse[]> {
    const requestedLimit = query.limit ? Number(query.limit) : undefined;
    if (requestedLimit !== undefined && requestedLimit > RETURN_REMINDER_LIST_MAX_LIMIT) {
      throw new BadRequestException(`limit no puede ser mayor a ${RETURN_REMINDER_LIST_MAX_LIMIT}.`);
    }
    const items = await this.listReminders.execute(
      new ListReturnRemindersQuery(
        req.firebaseUid!,
        query.companyId,
        query.branchId,
        query.status ? [query.status] : ['PENDING', 'FAILED'],
        requestedLimit ?? RETURN_REMINDER_LIST_DEFAULT_LIMIT,
      ),
    );
    return items.map(toReminderInboxItemResponse);
  }

  /** BR-DEV-001 / BR-DEV-011: alertas de garantía por liberar (24 h) e inmovilización > 24 h. Antes de `:id`. */
  @Get('alerts')
  async alerts(@Req() req: AuthenticatedRequest, @Query() query: ListReturnAlertsQueryDto): Promise<ReturnAlertItemResponse[]> {
    const requestedLimit = query.limit ? Number(query.limit) : undefined;
    if (requestedLimit !== undefined && requestedLimit > RETURN_ALERT_LIST_MAX_LIMIT) {
      throw new BadRequestException(`limit no puede ser mayor a ${RETURN_ALERT_LIST_MAX_LIMIT}.`);
    }
    const items = await this.listAlerts.execute(
      new ListReturnAlertsQuery(
        req.firebaseUid!,
        query.companyId,
        query.branchId,
        query.type,
        requestedLimit ?? RETURN_ALERT_LIST_DEFAULT_LIMIT,
      ),
    );
    return items.map(toReturnAlertItemResponse);
  }

  /** Debe declararse antes de `:id` para que no lo capture ParseUUIDPipe. */
  @Get('cosmetic-tariff')
  async cosmeticTariff(
    @Req() req: AuthenticatedRequest,
    @Query() query: ReturnScopeQueryDto,
  ): Promise<CosmeticTariffResponse> {
    const items = await this.getCosmeticTariff.execute(
      new GetCosmeticTariffQuery(req.firebaseUid!, query.companyId, query.branchId),
    );
    return toCosmeticTariffResponse(items);
  }

  @Get(':id')
  async detail(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ReturnScopeQueryDto,
  ): Promise<ReturnResponse> {
    const found = await this.getReturn.execute(
      new GetReturnQuery(id, req.firebaseUid!, query.companyId, query.branchId),
    );
    return toReturnResponse(found);
  }

  /** PROP-015b — plantilla de documento de responsabilidad para la firma del cliente (BR-DEV-009). */
  @Get(':id/responsibility-template')
  async responsibilityTemplate(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ReturnScopeQueryDto,
  ): Promise<ResponsibilityTemplateResponse> {
    const template = await this.getResponsibilityTemplate.execute(
      new GetResponsibilityTemplateQuery(id, req.firebaseUid!, query.companyId, query.branchId),
    );
    return toResponsibilityTemplateResponse(template);
  }

  @Post(':id/commands/register-alcohol-test')
  @HttpCode(200)
  @UseInterceptors(IdempotencyInterceptor)
  async registerAlcoholTestCommand(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RegisterReturnAlcoholTestDto,
    @Headers('if-match') ifMatch: string,
  ): Promise<ReturnResponse> {
    const updated = await this.registerAlcoholTest.execute(
      new RegisterReturnAlcoholTestCommand(
        id,
        req.firebaseUid!,
        dto.companyId,
        dto.branchId,
        parseVersionIfMatch(ifMatch),
        dto.result,
        dto.notes,
      ),
    );
    return toReturnResponse(updated);
  }

  @Post(':id/commands/resolve-alcohol-escalation')
  @HttpCode(200)
  @UseInterceptors(IdempotencyInterceptor)
  async resolveAlcoholEscalationCommand(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveAlcoholEscalationDto,
    @Headers('if-match') ifMatch: string,
  ): Promise<ReturnResponse> {
    const updated = await this.resolveAlcoholEscalation.execute(
      new ResolveAlcoholEscalationCommand(
        id,
        req.firebaseUid!,
        dto.companyId,
        dto.branchId,
        parseVersionIfMatch(ifMatch),
        dto.decision,
        dto.markCustomerRed,
        dto.notes,
      ),
    );
    return toReturnResponse(updated);
  }

  @Post(':id/commands/complete-inspection')
  @HttpCode(200)
  @UseInterceptors(IdempotencyInterceptor)
  async completeInspectionCommand(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CompleteInspectionDto,
    @Headers('if-match') ifMatch: string,
  ): Promise<ReturnResponse> {
    const updated = await this.completeInspection.execute(
      new CompleteInspectionCommand(
        id,
        req.firebaseUid!,
        dto.companyId,
        dto.branchId,
        parseVersionIfMatch(ifMatch),
        dto.hasDamages,
        dto.damagesDescription,
        dto.notes,
        dto.responsibilityDocument,
      ),
    );
    return toReturnResponse(updated);
  }

  @Post(':id/commands/assess-damage')
  @HttpCode(200)
  @UseInterceptors(IdempotencyInterceptor)
  async assessDamageCommand(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssessDamageDto,
    @Headers('if-match') ifMatch: string,
  ): Promise<ReturnDamageResponse> {
    const result = await this.assessDamage.execute(
      new AssessDamageCommand(
        id,
        req.firebaseUid!,
        dto.companyId,
        dto.branchId,
        parseVersionIfMatch(ifMatch),
        dto.origin,
        dto.severity,
        dto.damagedZone,
        dto.estimatedAmount,
        dto.externalReportReference,
        dto.description,
        dto.customerAcceptsCost,
      ),
    );
    return toReturnDamageResponse(result.damage, result.rentalReturn, result.customerRiskStatus);
  }

  @Post(':id/commands/charge-immobilization')
  @UseInterceptors(IdempotencyInterceptor)
  async chargeImmobilizationCommand(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChargeImmobilizationDto,
    @Headers('if-match') ifMatch: string,
  ): Promise<ImmobilizationChargeResponse> {
    const result = await this.chargeImmobilization.execute(
      new ChargeImmobilizationCommand(
        id,
        req.firebaseUid!,
        dto.companyId,
        dto.branchId,
        parseVersionIfMatch(ifMatch),
        dto.daysCharged,
        dto.damageId,
        dto.notes,
      ),
    );
    return toImmobilizationChargeResponse(result.charge, result.rentalReturn);
  }

  /** BR-DEV-004 / DAT-DEV-001: registra el resultado del envío manual del recordatorio. If-Match = reminder.version. */
  @Post(':id/commands/register-reminder')
  @HttpCode(200)
  @UseInterceptors(IdempotencyInterceptor)
  async registerReminderCommand(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RegisterReturnReminderDto,
    @Headers('if-match') ifMatch: string,
  ): Promise<ReturnReminderResponse> {
    const result = await this.registerReminder.execute(
      new RegisterReturnReminderCommand(
        id,
        req.firebaseUid!,
        dto.companyId,
        dto.branchId,
        parseVersionIfMatch(ifMatch),
        dto.result,
        dto.sentAt ? new Date(dto.sentAt) : undefined,
        dto.note,
      ),
    );
    return toReturnReminderResponse(result.reminder);
  }

  @Post(':id/commands/close-financial')
  @HttpCode(200)
  @UseInterceptors(IdempotencyInterceptor)
  async closeFinancialCommand(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CloseFinancialDto,
    @Headers('if-match') ifMatch: string,
  ): Promise<ReturnResponse> {
    const updated = await this.closeFinancial.execute(
      new CloseFinancialCommand(
        id,
        req.firebaseUid!,
        dto.companyId,
        dto.branchId,
        parseVersionIfMatch(ifMatch),
        dto.refundAmount,
        dto.retainedAmount,
        dto.notes,
      ),
    );
    return toReturnResponse(updated);
  }

  @Post(':id/commands/close')
  @HttpCode(200)
  @UseInterceptors(IdempotencyInterceptor)
  async closeCommand(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CloseReturnDto,
    @Headers('if-match') ifMatch: string,
  ): Promise<ReturnResponse> {
    const updated = await this.closeReturn.execute(
      new CloseReturnCommand(
        id,
        req.firebaseUid!,
        dto.companyId,
        dto.branchId,
        parseVersionIfMatch(ifMatch),
        dto.signatureData,
        dto.generateWarrantyAct,
        dto.notes,
      ),
    );
    return toReturnResponse(updated);
  }
}
