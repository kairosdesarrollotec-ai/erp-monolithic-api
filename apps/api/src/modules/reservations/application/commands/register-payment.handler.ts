import { Injectable, NotFoundException } from '@nestjs/common';
import { ReservationRepositoryPort, ReservationRecord } from '../ports/reservation-repository.port';
import { ReservationDocumentRepositoryPort } from '../ports/reservation-document-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import {
  InvalidDepositAmountError,
  PaymentProofRequiredError,
  PaymentVoucherNotFoundError,
  ReservationStateConflictError,
} from '../../domain/reservation-errors';
import { missingPaymentProof } from '../../domain/reservation-payment-method';
import { RegisterPaymentCommand } from './register-payment.command';

/**
 * RES-P09 (BR-RES-001) + decision 8 (Russbel 22-oct-2026) - registra el pago de la reserva con su comprobante y marca
 * payment_validated_at ("se verifican con el envio del comprobante"). Nunca crea un vehicle_commitment por si solo
 * (BR-RES-009, DR-RES-002 - el bloqueo es atomico y ocurre unicamente en ConfirmReservationHandler).
 *
 * - Medios: TRANSFERENCIA, DEPOSITO, PLIN, YAPE, EFECTIVO, POS (validado en el DTO).
 * - El monto requerido y la version de politica los lee el SERVIDOR (los fijo la reserva al crearse desde la politica
 *   ADM-03). monto pagado < requerido -> 422 INVALID_DEPOSIT_AMOUNT. Monto mayor tambien se rechaza (PROPUESTO): no hay
 *   saldo a favor (decision 2), la reserva se cobra exacta.
 * - Comprobante obligatorio para todos los metodos; en EFECTIVO basta el nº de recibo o el comprobante (PROPUESTO).
 *   `voucherDocumentId` debe ser un PAYMENT_VOUCHER subido a esta misma reserva.
 *
 * Hallazgo critico "IDOR entre sedes/empresas": scope completo. Solo se puede registrar pago mientras la reserva sigue
 * en DRAFT. Mutacion + auditoria en una transaccion.
 */
@Injectable()
export class RegisterPaymentHandler {
  constructor(
    private readonly reservations: ReservationRepositoryPort,
    private readonly documents: ReservationDocumentRepositoryPort,
    private readonly workContext: WorkContextAuthorizationService,
    private readonly matrixAuth: MatrixAuthorizationService,
    private readonly transactionManager: TransactionManagerPort,
    private readonly auditRepository: AuditEventRepositoryPort,
  ) {}

  async execute(command: RegisterPaymentCommand): Promise<ReservationRecord> {
    const context = await this.workContext.authorize({
      firebaseUid: command.firebaseUid,
      companyId: command.companyId,
      branchId: command.branchId,
    });

    await this.matrixAuth.assertAllowed(context.organizationId, context.roleId, 'RESERVATION', 'REGISTER_PAYMENT', { companyId: context.companyId, branchId: context.branchId });

    const scope = {
      organizationId: context.organizationId,
      operatingCompanyId: command.companyId,
      branchId: command.branchId,
    };

    const existing = await this.reservations.findById(command.id, scope);
    if (!existing) {
      throw new NotFoundException('Reserva no encontrada.');
    }
    if (existing.status !== 'DRAFT') {
      throw new ReservationStateConflictError('registrar el pago de', existing.status);
    }

    const paidCents = Math.round(Number(command.amount) * 100);
    const requiredCents = Math.round(Number(existing.requiredPaymentAmount) * 100);
    if (paidCents < requiredCents) {
      throw new InvalidDepositAmountError(command.amount, existing.requiredPaymentAmount, 'BELOW_REQUIRED');
    }
    if (paidCents > requiredCents) {
      throw new InvalidDepositAmountError(command.amount, existing.requiredPaymentAmount, 'ABOVE_REQUIRED');
    }

    const missing = missingPaymentProof({
      method: command.method,
      operationNumber: command.operationNumber,
      payerName: command.payerName,
      voucherDocumentId: command.voucherDocumentId,
    });
    if (missing.length > 0) {
      throw new PaymentProofRequiredError(missing);
    }

    return this.transactionManager.run(async (tx) => {
      if (command.voucherDocumentId) {
        const voucher = await this.documents.findById(command.voucherDocumentId, existing.id, tx);
        if (!voucher || voucher.documentType !== 'PAYMENT_VOUCHER') {
          throw new PaymentVoucherNotFoundError();
        }
      }

      const updated = await this.reservations.registerPayment(
        command.id,
        scope,
        command.expectedVersion,
        {
          amount: (paidCents / 100).toFixed(2),
          method: command.method,
          operationNumber: command.operationNumber,
          payerName: command.payerName,
          voucherDocumentId: command.voucherDocumentId,
          registeredBy: command.firebaseUid,
        },
        tx,
      );

      await this.auditRepository.recordReservationEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.firebaseUid,
          reservationId: updated.id,
          action: 'RESERVATION_PAYMENT_REGISTERED',
          changes: {
            amount: (paidCents / 100).toFixed(2),
            currency: existing.currency,
            requiredAmount: existing.requiredPaymentAmount,
            paymentPolicyVersion: existing.paymentPolicyVersion,
            method: command.method,
            operationNumber: command.operationNumber ?? null,
            payerName: command.payerName.trim(),
            voucherDocumentId: command.voucherDocumentId ?? null,
          },
        },
        tx,
      );

      return updated;
    });
  }
}
