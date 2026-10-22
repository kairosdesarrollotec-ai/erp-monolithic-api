import { BadRequestException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { RentalRepositoryPort, RentalRecord, FormalizeContractPaymentInput } from '../ports/rental-repository.port';
import { ContractTemplateResolver } from '../services/contract-template-resolver';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import {
  DepositNotApplicableWithCompanyDriverError,
  ExternalAgentVerificationRequiredError,
  GuaranteeBelowRequiredError,
  GuaranteePaymentProofRequiredError,
  GuaranteeVoucherNotFoundError,
  RentalStateConflictError,
} from '../../domain/rental-errors';
import { computeDepositBreakdown, computeNoDepositBreakdown, resolveReservationCredit, toCents } from '../../domain/reservation-credit';
import { requiredGuarantee } from '../../domain/guarantee-requirement';
import { missingPaymentProof, PAYMENT_METHODS, PaymentMethod } from '../../../reservations/domain/reservation-payment-method';
import { contractVariantCode, contractVariantLabel } from '../../domain/contract-variant';
import { FormalizeContractCommand } from './formalize-contract.command';

/**
 * ALQ-06 / BR-DOC-002 / BR-DOC-003 - Formalización de Contrato y Garantía.
 * TDD-03-alquiler.md seccion 10.1 / 11.3
 * Transiciona Rental de CONTRACTING a PENDING_DELIVERY.
 *
 * Russbel 22-oct-2026:
 * - Decision 2: el monto de la reserva se traslada ÍNTEGRO a la garantía y se cobra solo la diferencia; NO hay saldo a
 *   favor (validacion defensiva 422 RESERVATION_EXCEEDS_GUARANTEE si la reserva superara la garantia; ya no se escribe
 *   `reservationCreditExcess`).
 * - Matriz notarial: la garantía exigida sale de la tarifa de Flota (`Vehicle.depositMinimum`) y se DUPLICA con
 *   DOUBLE_DEPOSIT (la tercera vía no la duplica). `depositAmount` es opcional (default = exigida); menor a la exigida -> 422
 *   INVALID_DEPOSIT_AMOUNT. La tercera vía exige el documento de responsabilidad firmado (RESPONSIBILITY_DOCUMENT).
 * - Decision 8 (ALQ P-01, BR-ALQ-011): si hay diferencia a cobrar, comprobante obligatorio (medio, nº de operación/recibo,
 *   pagador, comprobante subido); si paga un agente externo, verificación adicional (422
 *   EXTERNAL_AGENT_VERIFICATION_REQUIRED). Si la reserva cubre toda la garantía no hay cobro ni comprobante.
 */
@Injectable()
export class FormalizeContractHandler {
  constructor(
    private readonly rentals: RentalRepositoryPort,
    private readonly templateResolver: ContractTemplateResolver,
    private readonly workContext: WorkContextAuthorizationService,
    private readonly matrixAuth: MatrixAuthorizationService,
    private readonly transactionManager: TransactionManagerPort,
    private readonly auditRepository: AuditEventRepositoryPort,
    private readonly outboxRepository: OutboxEventRepositoryPort,
  ) {}

  async execute(command: FormalizeContractCommand): Promise<RentalRecord> {
    // DEC-ALQ-COMPANY-DRIVER-004: con conductor de la empresa se OMITE la garantia (Ficha AS-IS 5-ago, BR-DOC-003).
    const depositRequired = command.contractVariant?.withCompanyDriver !== true;
    if (!depositRequired) {
      if (command.depositAmount && Number(command.depositAmount) > 0) {
        throw new DepositNotApplicableWithCompanyDriverError();
      }
    } else if (command.depositAmount !== undefined && Number(command.depositAmount) <= 0) {
      throw new BadRequestException({
        code: 'INVALID_DEPOSIT_AMOUNT',
        detail: 'El monto de garantía debe ser mayor a cero.',
      });
    }

    const context = await this.workContext.authorize({
      firebaseUid: command.firebaseUid,
      companyId: command.companyId,
      branchId: command.branchId,
    });

    await this.matrixAuth.assertAllowed(context.organizationId, context.roleId, 'RENTAL', 'FORMALIZE_CONTRACT', { companyId: context.companyId, branchId: context.branchId });

    const scope = {
      organizationId: context.organizationId,
      operatingCompanyId: command.companyId,
      branchId: command.branchId,
    };

    const existing = await this.rentals.findById(command.id, scope);
    if (!existing) {
      throw new NotFoundException('Alquiler no encontrado.');
    }
    if (existing.status !== 'CONTRACTING') {
      throw new RentalStateConflictError('formalizar contrato en', existing.status);
    }

    // Garantia exigida (tarifa de Flota x multiplicador notarial) y monto/moneda efectivos.
    const notaryResult = existing.notaryEvaluation?.result ?? null;
    const required = requiredGuarantee(existing.vehicleDepositMinimum, notaryResult);
    let depositAmount = command.depositAmount;
    if (depositRequired) {
      if (depositAmount === undefined) {
        if (!required) {
          throw new BadRequestException({
            code: 'INVALID_DEPOSIT_AMOUNT',
            detail: 'El vehículo no tiene garantía definida en Flota: indique el monto de la garantía (depositAmount).',
          });
        }
        depositAmount = required.amount;
      } else if (required && toCents(depositAmount) < toCents(required.amount)) {
        throw new GuaranteeBelowRequiredError(depositAmount, required.amount, required.multiplier);
      }
      if (command.depositAmount !== undefined && !command.depositCurrency) {
        throw new BadRequestException({
          code: 'INVALID_DEPOSIT_CURRENCY',
          detail: 'La moneda de la garantía es obligatoria.',
        });
      }
    }
    const depositCurrency = command.depositCurrency ?? 'PEN';

    const resolved = await this.templateResolver.resolve(
      command.companyId,
      context.organizationId,
      command.contractVariant,
    );
    if (!resolved.template) {
      throw new BadRequestException({
        code: 'NO_ACTIVE_CONTRACT_TEMPLATE',
        detail: command.contractVariant
          ? `La empresa no tiene una plantilla de contrato vigente para ${contractVariantLabel(command.contractVariant)}.`
          : 'La empresa no tiene una plantilla de contrato de alquiler vigente configurada.',
      });
    }
    const templateId = resolved.template.id;
    const contractVariant = command.contractVariant ? contractVariantCode(command.contractVariant) : undefined;

    return this.transactionManager.run(async (tx) => {
      const current = await this.rentals.findById(command.id, scope, tx);
      if (!current) {
        throw new NotFoundException('Alquiler no encontrado.');
      }
      if (current.status !== 'CONTRACTING') {
        throw new RentalStateConflictError('formalizar contrato en', current.status);
      }

      // Tercera via (BR-ALQ-004 / DAT-ALQ-008): se firma el documento de responsabilidad en vez de ir a notaria.
      if (
        depositRequired &&
        current.notaryEvaluation?.result === 'THIRD_PATH_ELIGIBLE' &&
        (await this.rentals.countRentalDocumentsByType(command.id, 'RESPONSIBILITY_DOCUMENT', tx)) === 0
      ) {
        throw new UnprocessableEntityException({
          code: 'RESPONSIBILITY_DOCUMENT_REQUIRED',
          detail: 'La tercera vía exige el documento de responsabilidad firmado: suba un documento RESPONSIBILITY_DOCUMENT antes de formalizar.',
        });
      }

      // P0-03 opcion (a) + decision 2: el monto de la reserva se traslada integro a la garantia (sin saldo a favor) y se
      // cobra la diferencia. Se lee dentro de la transaccion para no depender de lo que mostro la vista previa.
      const creditSource = current.reservationId
        ? await this.rentals.findReservationCreditSource(current.reservationId, tx)
        : null;
      const credit = resolveReservationCredit(creditSource);
      const noDeposit = depositRequired ? null : computeNoDepositBreakdown(credit);
      const breakdown = depositRequired
        ? computeDepositBreakdown(depositAmount as string, depositCurrency, credit)
        : {
            totalAmount: '0.00',
            reservationCreditAmount: '0.00',
            reservationCreditExcess: '0.00',
            amountToCollect: '0.00',
            currency: credit.currency ?? depositCurrency,
          };

      // Decision 8: comprobante del cobro (solo si hay diferencia a cobrar).
      const mustCollect = depositRequired && toCents(breakdown.amountToCollect) > 0;
      const payment = mustCollect ? await this.resolvePayment(command, breakdown.amountToCollect, tx) : undefined;

      const updated = await this.rentals.formalizeContract(
        {
          rentalId: command.id,
          scope,
          expectedVersion: command.expectedVersion,
          templateId,
          documentRef: command.documentRef,
          depositRequired,
          depositAmount: breakdown.totalAmount,
          currency: breakdown.currency,
          reservationCreditAmount: breakdown.reservationCreditAmount,
          reservationCreditExcess: breakdown.reservationCreditExcess,
          contractVariant,
          updatedBy: command.firebaseUid,
          signatureData: command.signatureData,
          payment,
        },
        tx,
      );

      await this.auditRepository.recordRentalEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.firebaseUid,
          rentalId: updated.id,
          action: 'CONTRACT_FORMALIZED',
          changes: {
            templateId,
            contractVariant: contractVariant ?? null,
            templateFallbackUsed: resolved.fallbackUsed,
            documentRef: command.documentRef,
            depositRequired,
            depositAmount: breakdown.totalAmount,
            depositCurrency: depositRequired ? breakdown.currency : null,
            requiredGuarantee: required,
            notaryResult,
            reservationId: current.reservationId,
            reservationCreditApplied: credit.applicable && depositRequired,
            reservationCreditReason: credit.reason,
            reservationCreditAmount: breakdown.reservationCreditAmount,
            // Decision 2: nunca hay excedente; con conductor de la empresa el pago de la reserva queda sin aplicar (Finanzas).
            unappliedReservationAmount: noDeposit?.unappliedReservationAmount ?? '0.00',
            amountCollected: breakdown.amountToCollect,
            payment: payment
              ? {
                  method: payment.method,
                  operationNumber: payment.operationNumber ?? null,
                  payerName: payment.payerName,
                  payerDocumentNumber: payment.payerDocumentNumber ?? null,
                  payerIsExternalAgent: payment.payerIsExternalAgent,
                  externalAgentVerifiedBy: payment.externalAgentVerifiedBy ?? null,
                  voucherDocumentId: payment.voucherDocumentId ?? null,
                }
              : null,
            newStatus: 'PENDING_DELIVERY',
          },
        },
        tx,
      );

      await this.outboxRepository.publish(
        {
          aggregateType: 'rental',
          aggregateId: updated.id,
          eventType: 'ContratoFirmado.v1',
          payload: {
            rentalId: updated.id,
            documentRef: command.documentRef,
            signedAt: new Date().toISOString(),
          },
        },
        tx,
      );

      // Sin garantia no hay pago de garantia que registrar.
      if (depositRequired) await this.outboxRepository.publish(
        {
          aggregateType: 'rental',
          aggregateId: updated.id,
          eventType: 'PagoRegistrado.v1',
          payload: {
            rentalId: updated.id,
            depositAmount: breakdown.totalAmount,
            currency: breakdown.currency,
            reservationCreditAmount: breakdown.reservationCreditAmount,
            reservationCreditExcess: '0.00',
            amountCollected: breakdown.amountToCollect,
            type: 'SECURITY_DEPOSIT',
            method: payment?.method ?? null,
            operationNumber: payment?.operationNumber ?? null,
            payerName: payment?.payerName ?? null,
            payerIsExternalAgent: payment?.payerIsExternalAgent ?? false,
            voucherDocumentId: payment?.voucherDocumentId ?? null,
          },
        },
        tx,
      );

      return updated;
    });
  }

  /**
   * Decision 8 / BR-ALQ-011: valida y arma el comprobante del cobro de la garantia. Regla propuesta (PROPUESTO):
   * comprobante obligatorio para todos los medios; en EFECTIVO basta el nº de recibo o el comprobante. Si paga un
   * agente externo: documento del pagador + verificacion adicional confirmada.
   */
  private async resolvePayment(
    command: FormalizeContractCommand,
    amountToCollect: string,
    tx: Prisma.TransactionClient,
  ): Promise<FormalizeContractPaymentInput> {
    const input = command.payment;
    if (!input) {
      throw new GuaranteePaymentProofRequiredError(['payment (medio, nº de operación, pagador y comprobante)']);
    }
    if (!PAYMENT_METHODS.includes(input.method as PaymentMethod)) {
      throw new BadRequestException({
        code: 'INVALID_PAYMENT_METHOD',
        detail: `Medio de pago no válido. Use ${PAYMENT_METHODS.join(', ')}.`,
      });
    }
    const missing = missingPaymentProof({
      method: input.method as PaymentMethod,
      operationNumber: input.operationNumber,
      payerName: input.payerName,
      voucherDocumentId: input.voucherDocumentId,
    });
    if (missing.length > 0) {
      throw new GuaranteePaymentProofRequiredError(missing);
    }
    if (input.payerIsExternalAgent && (!input.externalAgentVerified || !input.payerDocumentNumber?.trim())) {
      throw new ExternalAgentVerificationRequiredError();
    }
    if (input.voucherDocumentId) {
      const voucher = await this.rentals.findRentalDocumentById(input.voucherDocumentId, command.id, tx);
      if (!voucher || voucher.documentType !== 'PAYMENT_VOUCHER') {
        throw new GuaranteeVoucherNotFoundError();
      }
    }
    return {
      amount: amountToCollect,
      method: input.method,
      operationNumber: input.operationNumber,
      payerName: input.payerName,
      payerDocumentNumber: input.payerDocumentNumber,
      payerIsExternalAgent: input.payerIsExternalAgent,
      externalAgentVerifiedBy: input.payerIsExternalAgent ? command.firebaseUid : undefined,
      voucherDocumentId: input.voucherDocumentId,
      registeredBy: command.firebaseUid,
    };
  }
}
