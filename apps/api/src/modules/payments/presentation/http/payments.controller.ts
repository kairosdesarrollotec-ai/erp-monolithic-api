import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
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
import { ListDepositsHandler } from '../../application/queries/list-deposits.handler';
import { ListDepositsQuery } from '../../application/queries/list-deposits.query';
import { GetDepositHandler } from '../../application/queries/get-deposit.handler';
import { GetDepositQuery } from '../../application/queries/get-deposit.query';
import { GetDepositsSummaryHandler } from '../../application/queries/get-deposits-summary.handler';
import { GetDepositsSummaryQuery } from '../../application/queries/get-deposits-summary.query';
import { RegisterAdjustmentHandler } from '../../application/commands/register-adjustment.handler';
import { RegisterAdjustmentCommand } from '../../application/commands/register-adjustment.command';
import { ApproveRefundHandler } from '../../application/commands/approve-refund.handler';
import { ApproveRefundCommand } from '../../application/commands/approve-refund.command';
import { CloseFinancialHandler } from '../../application/commands/close-financial.handler';
import { CloseFinancialCommand } from '../../application/commands/close-financial.command';
import { ListDepositsQueryDto } from './dto/list-deposits-query.dto';
import { DepositScopeQueryDto } from './dto/deposit-scope-query.dto';
import { RegisterAdjustmentDto } from './dto/register-adjustment.dto';
import { ApproveRefundDto } from './dto/approve-refund.dto';
import { CloseFinancialDto } from './dto/close-financial.dto';
import { toDepositDetailResponse, toDepositSummaryResponse } from './deposit.mapper';
import type { AdjustmentResponseDto, DepositDetailResponseDto, DepositsSummaryResponseDto, ListDepositsResponseDto } from './dto/deposit.response';

const DEPOSIT_LIST_DEFAULT_LIMIT = 20;
const DEPOSIT_LIST_MAX_LIMIT = 100;

/**
 * Pagos y Garantias (PAG-01 bandeja, PAG-02 detalle) — contrato: packages/contracts/openapi/payments.yaml.
 * Requiere FirebaseAuthGuard global. Los POST de comandos aceptan Idempotency-Key (opcional).
 * Aislamiento multiempresa por companyId + branchId del actor (BR-PAG-009).
 */
@Controller('payments')
@UseGuards(FirebaseAuthGuard)
export class PaymentsController {
  constructor(
    private readonly listDeposits: ListDepositsHandler,
    private readonly getDeposit: GetDepositHandler,
    private readonly getDepositsSummary: GetDepositsSummaryHandler,
    private readonly registerAdjustment: RegisterAdjustmentHandler,
    private readonly approveRefund: ApproveRefundHandler,
    private readonly closeFinancial: CloseFinancialHandler,
  ) {}

  /** PAG-01 — bandeja con filtros y paginacion keyset (UC-PAG-001, PAYMENT.READ_LIST). */
  @Get('deposits')
  async list(@Req() req: AuthenticatedRequest, @Query() query: ListDepositsQueryDto): Promise<ListDepositsResponseDto> {
    const requestedLimit = query.limit ?? DEPOSIT_LIST_DEFAULT_LIMIT;
    if (requestedLimit > DEPOSIT_LIST_MAX_LIMIT) {
      throw new BadRequestException(`limit no puede ser mayor a ${DEPOSIT_LIST_MAX_LIMIT}.`);
    }

    let cursor: { createdAt: Date; id: string } | undefined;
    if (query.cursorCreatedAt || query.cursorId) {
      if (!query.cursorCreatedAt || !query.cursorId) {
        throw new BadRequestException('cursorCreatedAt y cursorId deben enviarse juntos para paginar.');
      }
      cursor = { createdAt: new Date(query.cursorCreatedAt), id: query.cursorId };
    }

    const { data, total } = await this.listDeposits.execute(
      new ListDepositsQuery(req.firebaseUid!, query.companyId, query.branchId, query.status, query.rentalId, requestedLimit, cursor),
    );

    const lastItem = data[data.length - 1];
    const hasMore = data.length === requestedLimit;

    return {
      data: data.map(toDepositSummaryResponse),
      meta: {
        total,
        hasMore,
        nextCursorCreatedAt: hasMore && lastItem ? lastItem.createdAt.toISOString() : null,
        nextCursorId: hasMore && lastItem ? lastItem.id : null,
      },
    };
  }

  /** PAG-01 — resumen agregado por estado para tarjetas (PAYMENT.READ_LIST). */
  @Get('deposits/summary')
  async summary(
    @Req() req: AuthenticatedRequest,
    @Query() query: DepositScopeQueryDto,
  ): Promise<DepositsSummaryResponseDto> {
    const result = await this.getDepositsSummary.execute(
      new GetDepositsSummaryQuery(req.firebaseUid!, query.companyId, query.branchId),
    );
    return result;
  }

  /** PAG-02 — detalle con historial de ajustes (UC-PAG-002, PAYMENT.READ_DETAIL). */
  @Get('deposits/:depositId')
  async detail(
    @Req() req: AuthenticatedRequest,
    @Param('depositId', ParseUUIDPipe) depositId: string,
    @Query() query: DepositScopeQueryDto,
  ): Promise<DepositDetailResponseDto> {
    const found = await this.getDeposit.execute(new GetDepositQuery(depositId, req.firebaseUid!, query.companyId, query.branchId));
    return toDepositDetailResponse(found);
  }

  /** PAG-P03 — registrar ajuste append-only (UC-PAG-003, PAYMENT.REGISTER_ADJUSTMENT). */
  @Post('deposits/:depositId/adjustments')
  @UseInterceptors(IdempotencyInterceptor)
  async registerAdjustmentCommand(
    @Req() req: AuthenticatedRequest,
    @Param('depositId', ParseUUIDPipe) depositId: string,
    @Body() dto: RegisterAdjustmentDto,
  ): Promise<AdjustmentResponseDto> {
    const adjustment = await this.registerAdjustment.execute(
      new RegisterAdjustmentCommand(depositId, req.firebaseUid!, dto.companyId, dto.branchId, dto.type, dto.amount, dto.reason),
    );
    return {
      id: adjustment.id,
      depositId: adjustment.depositId,
      type: adjustment.type,
      amount: adjustment.amount,
      reason: adjustment.reason,
      actorId: adjustment.authorizedBy,
      createdAt: adjustment.createdAt.toISOString(),
    };
  }

  /** PAG-P04 — aprobar devolucion de garantia (UC-PAG-004, PAYMENT.APPROVE_REFUND). */
  @Post('deposits/:depositId/approve-refund')
  @HttpCode(200)
  @UseInterceptors(IdempotencyInterceptor)
  async approveRefundCommand(
    @Req() req: AuthenticatedRequest,
    @Param('depositId', ParseUUIDPipe) depositId: string,
    @Body() dto: ApproveRefundDto,
  ): Promise<DepositDetailResponseDto> {
    const updated = await this.approveRefund.execute(
      new ApproveRefundCommand(depositId, req.firebaseUid!, dto.companyId, dto.branchId, dto.notes),
    );
    return toDepositDetailResponse(updated);
  }

  /** PAG-P05 — cerrar expediente financiero (UC-PAG-005, PAYMENT.CLOSE_FINANCIAL). */
  @Post('deposits/:depositId/close')
  @HttpCode(200)
  @UseInterceptors(IdempotencyInterceptor)
  async closeFinancialCommand(
    @Req() req: AuthenticatedRequest,
    @Param('depositId', ParseUUIDPipe) depositId: string,
    @Body() dto: CloseFinancialDto,
  ): Promise<DepositDetailResponseDto> {
    const updated = await this.closeFinancial.execute(
      new CloseFinancialCommand(depositId, req.firebaseUid!, dto.companyId, dto.branchId, dto.retainedAmount, dto.notes),
    );
    return toDepositDetailResponse(updated);
  }
}
