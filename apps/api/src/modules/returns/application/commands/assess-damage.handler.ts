import { Injectable } from '@nestjs/common';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import { ReturnDamageRecord, ReturnRecord, ReturnRepositoryPort } from '../ports/return-repository.port';
import { ReturnCustomerRiskPort } from '../ports/return-customer-risk.port';
import { ReturnAccessService } from '../services/return-access.service';
import { ReturnNotFoundError, ReturnStateConflictError } from '../../domain/return-errors';
import { resolveDamageAssessment } from '../../domain/damage-assessment';
import { CustomerRiskStatus, resolveRiskTargetAfterDamage } from '../../domain/customer-risk-status';
import { AssessDamageCommand } from './assess-damage.command';

export interface AssessDamageResult {
  damage: ReturnDamageRecord;
  rentalReturn: ReturnRecord;
  /** Semáforo del cliente resultante tras evaluar el daño (BR-DEV-007, solo avanza). */
  customerRiskStatus: CustomerRiskStatus;
}

/**
 * DEV-06 / DEV-07 / BR-DEV-006 / DR-DEV-002 - Evalúa un daño del vehículo devuelto.
 *  - Estético: monto SIEMPRE del tarifario fijo por paño (el cliente no fija el monto).
 *  - Técnico: nunca se calcula; exige referencia del informe externo (Motrix) y registra el monto manual.
 * Semáforo (BR-DEV-007/008): GRAVE -> ROJO; LEVE/MODERADO con customerAcceptsCost=true -> AMBAR; nunca retrocede.
 * Customer.status se escribe en la misma transacción.
 * El agregado conserva CON_DANOS (se pueden evaluar varios daños) y su versión se incrementa.
 */
@Injectable()
export class AssessDamageHandler {
  constructor(
    private readonly access: ReturnAccessService,
    private readonly returns: ReturnRepositoryPort,
    private readonly customerRisk: ReturnCustomerRiskPort,
    private readonly transactionManager: TransactionManagerPort,
    private readonly auditRepository: AuditEventRepositoryPort,
    private readonly outboxRepository: OutboxEventRepositoryPort,
  ) {}

  async execute(command: AssessDamageCommand): Promise<AssessDamageResult> {
    const { context, scope } = await this.access.authorize(command, 'ASSESS_DAMAGE');

    // BR-DEV-006: validar/calcular antes de tocar la base (falla rápido con 422).
    const resolved = resolveDamageAssessment({
      origin: command.origin,
      severity: command.severity,
      damagedZone: command.damagedZone,
      estimatedAmount: command.estimatedAmount,
      externalReportReference: command.externalReportReference,
      description: command.description,
    });

    const existing = await this.returns.findById(command.id, scope);
    if (!existing) {
      throw new ReturnNotFoundError(command.id);
    }
    if (existing.status !== 'CON_DANOS') {
      throw new ReturnStateConflictError('evaluar daños en', existing.status);
    }

    return this.transactionManager.run(async (tx) => {
      const current = await this.returns.findById(command.id, scope, tx);
      if (!current) {
        throw new ReturnNotFoundError(command.id);
      }
      if (current.status !== 'CON_DANOS') {
        throw new ReturnStateConflictError('evaluar daños en', current.status);
      }

      const updated = await this.returns.update(
        {
          id: command.id,
          scope,
          expectedVersion: command.expectedVersion,
          custodyHolder: resolved.origin === 'TECHNICAL' ? 'TALLER' : undefined,
          updatedBy: command.firebaseUid,
        },
        tx,
      );

      const damage = await this.returns.addDamage(
        {
          returnId: updated.id,
          origin: resolved.origin,
          severity: resolved.severity,
          damagedZone: resolved.damagedZone ?? undefined,
          estimatedAmount: resolved.estimatedAmount ?? undefined,
          externalReportReference: resolved.externalReportReference ?? undefined,
          description: resolved.description ?? undefined,
        },
        tx,
      );

      const risk = await this.customerRisk.escalate(
        {
          customerId: updated.customerId,
          organizationId: context.organizationId,
          operatingCompanyId: scope.operatingCompanyId,
          target: resolveRiskTargetAfterDamage(resolved.severity, command.customerAcceptsCost) ?? 'NORMAL',
        },
        tx,
      );
      await this.auditRepository.recordRentalEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.firebaseUid,
          rentalId: updated.rentalId,
          action: 'RETURN_DAMAGE_ASSESSED',
          changes: {
            returnId: updated.id,
            damageId: damage.id,
            origin: resolved.origin,
            severity: resolved.severity,
            damagedZone: resolved.damagedZone,
            estimatedAmount: resolved.estimatedAmount,
            externalReportReference: resolved.externalReportReference,
            custodyHolder: updated.custodyHolder,
            customerAcceptsCost: command.customerAcceptsCost,
            customerRiskStatus: risk.current,
            customerRiskPrevious: risk.previous,
          },
        },
        tx,
      );
      await this.outboxRepository.publish(
        {
          aggregateType: 'return',
          aggregateId: updated.id,
          eventType: 'PagoAjustado.v1',
          payload: {
            returnId: updated.id,
            rentalId: updated.rentalId,
            customerId: updated.customerId,
            concept: 'DAMAGE_ASSESSMENT',
            damageId: damage.id,
            origin: resolved.origin,
            severity: resolved.severity,
            amount: resolved.estimatedAmount,
            externalReportReference: resolved.externalReportReference,
            customerRiskStatus: risk.current,
            organizationId: context.organizationId,
            operatingCompanyId: context.companyId,
            branchId: context.branchId,
          },
        },
        tx,
      );

      return { damage, rentalReturn: updated, customerRiskStatus: risk.current };
    });
  }
}
