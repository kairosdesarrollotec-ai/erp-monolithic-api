import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { RentalRepositoryPort, RentalRecord } from '../ports/rental-repository.port';
import { ContractTemplateResolver } from '../services/contract-template-resolver';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import { DepositNotApplicableWithCompanyDriverError, RentalStateConflictError } from '../../domain/rental-errors';
import { computeDepositBreakdown, computeNoDepositBreakdown, resolveReservationCredit } from '../../domain/reservation-credit';
import { contractVariantCode, contractVariantLabel } from '../../domain/contract-variant';
import { FormalizeContractCommand } from './formalize-contract.command';

/**
 * ALQ-06 / BR-DOC-002 / BR-DOC-003 - Formalización de Contrato y Garantía.
 * TDD-03-alquiler.md seccion 10.1 / 11.3
 * Transiciona Rental de CONTRACTING a PENDING_DELIVERY.
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
    } else if (!command.depositAmount || Number(command.depositAmount) <= 0) {
      throw new BadRequestException({
        code: 'INVALID_DEPOSIT_AMOUNT',
        detail: 'El monto de garantía debe ser mayor a cero.',
      });
    } else if (!command.depositCurrency) {
      throw new BadRequestException({
        code: 'INVALID_DEPOSIT_CURRENCY',
        detail: 'La moneda de la garantía es obligatoria.',
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

      // P0-03 opcion (a): el monto de la reserva se traslada integro a la
      // garantia (solo origen Reserva) y se cobra la diferencia. Se lee dentro
      // de la transaccion para no depender de lo que mostro la vista previa.
      const creditSource = current.reservationId
        ? await this.rentals.findReservationCreditSource(current.reservationId, tx)
        : null;
      const credit = resolveReservationCredit(creditSource);
      const breakdown = depositRequired
        ? computeDepositBreakdown(command.depositAmount as string, command.depositCurrency as string, credit)
        : {
            totalAmount: '0.00',
            reservationCreditAmount: '0.00',
            reservationCreditExcess: computeNoDepositBreakdown(credit).reservationCreditExcess,
            amountToCollect: '0.00',
            currency: credit.currency ?? command.depositCurrency ?? 'PEN',
          };

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
            reservationId: current.reservationId,
            reservationCreditApplied: credit.applicable,
            reservationCreditReason: credit.reason,
            reservationCreditAmount: breakdown.reservationCreditAmount,
            reservationCreditExcess: breakdown.reservationCreditExcess,
            amountCollected: breakdown.amountToCollect,
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

      // Sin garantia no hay pago de garantia que registrar (el saldo a favor viaja en la auditoria y en el contrato).
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
            reservationCreditExcess: breakdown.reservationCreditExcess,
            amountCollected: breakdown.amountToCollect,
            type: 'SECURITY_DEPOSIT',
          },
        },
        tx,
      );

      return updated;
    });
  }
}
