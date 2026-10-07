import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { RentalRepositoryPort, RentalRecord } from '../ports/rental-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import { RentalStateConflictError } from '../../domain/rental-errors';
import { RENTAL_CONTRACT_TEMPLATE_TYPE } from '../../domain/contract-template-type';
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
    private readonly workContext: WorkContextAuthorizationService,
    private readonly matrixAuth: MatrixAuthorizationService,
    private readonly transactionManager: TransactionManagerPort,
    private readonly auditRepository: AuditEventRepositoryPort,
    private readonly outboxRepository: OutboxEventRepositoryPort,
  ) {}

  async execute(command: FormalizeContractCommand): Promise<RentalRecord> {
    if (!command.depositAmount || Number(command.depositAmount) <= 0) {
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

    let templateVersionId = command.templateVersionId;
    if (templateVersionId) {
      // Provisto explicitamente: debe existir, pertenecer a la empresa y estar vigente (ACTIVE).
      const templateOwned = await this.rentals.contractTemplateBelongsToCompany(
        templateVersionId,
        command.companyId,
      );
      if (!templateOwned) {
        throw new BadRequestException({
          code: 'INVALID_CONTRACT_TEMPLATE',
          detail: 'La plantilla de contrato no existe, no pertenece a la empresa autenticada o no esta vigente.',
        });
      }
    } else {
      // No provisto: resuelve automaticamente la plantilla ACTIVE vigente de la empresa (BR-DOC-002).
      const active = await this.rentals.findActiveContractTemplate(command.companyId, RENTAL_CONTRACT_TEMPLATE_TYPE);
      if (!active) {
        throw new BadRequestException({
          code: 'NO_ACTIVE_CONTRACT_TEMPLATE',
          detail: 'La empresa no tiene una plantilla de contrato vigente configurada.',
        });
      }
      templateVersionId = active.id;
    }

    return this.transactionManager.run(async (tx) => {
      const current = await this.rentals.findById(command.id, scope, tx);
      if (!current) {
        throw new NotFoundException('Alquiler no encontrado.');
      }
      if (current.status !== 'CONTRACTING') {
        throw new RentalStateConflictError('formalizar contrato en', current.status);
      }

      const updated = await this.rentals.formalizeContract(
        {
          rentalId: command.id,
          scope,
          expectedVersion: command.expectedVersion,
          templateVersionId,
          documentRef: command.documentRef,
          depositAmount: command.depositAmount,
          currency: command.depositCurrency,
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
            templateVersionId,
            documentRef: command.documentRef,
            depositAmount: command.depositAmount,
            depositCurrency: command.depositCurrency,
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

      await this.outboxRepository.publish(
        {
          aggregateType: 'rental',
          aggregateId: updated.id,
          eventType: 'PagoRegistrado.v1',
          payload: {
            rentalId: updated.id,
            depositAmount: command.depositAmount,
            currency: command.depositCurrency,
            type: 'SECURITY_DEPOSIT',
          },
        },
        tx,
      );

      return updated;
    });
  }
}
