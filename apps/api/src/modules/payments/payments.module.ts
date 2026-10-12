import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { AuditModule } from '../audit/audit.module';
import { OutboxModule } from '../outbox/outbox.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { PaymentsController } from './presentation/http/payments.controller';
import { PaymentAccessService } from './application/services/payment-access.service';
import { ListDepositsHandler } from './application/queries/list-deposits.handler';
import { GetDepositHandler } from './application/queries/get-deposit.handler';
import { GetDepositsSummaryHandler } from './application/queries/get-deposits-summary.handler';
import { RegisterAdjustmentHandler } from './application/commands/register-adjustment.handler';
import { ApproveRefundHandler } from './application/commands/approve-refund.handler';
import { CloseFinancialHandler } from './application/commands/close-financial.handler';
import { DepositRepositoryPort } from './application/ports/deposit-repository.port';
import { PrismaDepositRepository } from './infrastructure/persistence/prisma-deposit.repository';

/**
 * Pagos y Garantias (PAG-01/PAG-02). UsersModule aporta WorkContextAuthorizationService y
 * AuthorizationModule la matriz versionada (modulo PAYMENT, ADM-02). Audit/Outbox para
 * trazabilidad transaccional. PrismaModule (@Global) aporta PrismaService.
 * Opera sobre tablas existentes: rental_deposits y rental_deposit_adjustments (TDD-PAG-001).
 */
@Module({
  imports: [UsersModule, AuditModule, OutboxModule, AuthorizationModule],
  controllers: [PaymentsController],
  providers: [
    PaymentAccessService,
    ListDepositsHandler,
    GetDepositHandler,
    GetDepositsSummaryHandler,
    RegisterAdjustmentHandler,
    ApproveRefundHandler,
    CloseFinancialHandler,
    { provide: DepositRepositoryPort, useClass: PrismaDepositRepository },
  ],
})
export class PaymentsModule {}
