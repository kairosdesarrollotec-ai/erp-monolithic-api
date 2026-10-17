import { Injectable, NotFoundException } from '@nestjs/common';
import { RentalRepositoryPort, RentalRecord } from '../ports/rental-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import { RentalStateConflictError } from '../../domain/rental-errors';
import { ReportExtensionBreachCommand } from './report-extension-breach.command';

const LEGAL_EVALUATION_NOTE =
  'BR-ALQ-013: falta grave de ampliacion - el cliente retuvo el vehiculo sin cumplir ' +
  'los 4 requisitos (aviso 12h, autorizacion, pago, adenda firmada). Se retiene el 100% ' +
  'de la garantia y el caso requiere evaluacion de inicio de proceso penal.';

/**
 * UC-ALQ-006b / BR-ALQ-013 - Falta grave de ampliacion de Alquiler.
 * TDD-ALQ-001.md seccion 9.4 / BDD-ALQ-001.md seccion 9.4 y escenario @SC-ALQ-004.
 *
 * El cliente no cumplio los 4 requisitos de ampliacion (aviso con 12h de
 * anticipacion, autorizacion, pago, adenda firmada) y retuvo el vehiculo sin
 * autorizacion. Marca la extension pendiente como BREACH, retiene el 100% de
 * la garantia (RentalDepositAdjustment FULL_RETENTION) y marca al cliente
 * como "rojo" de inmediato.
 *
 * NO dispara automaticamente un proceso penal real (no hay a quien notificar
 * ni un flujo legal definido en BDD/SDD): solo deja constancia en auditoria
 * de que el caso requiere evaluacion legal.
 */
@Injectable()
export class ReportExtensionBreachHandler {
  constructor(
    private readonly rentals: RentalRepositoryPort,
    private readonly workContext: WorkContextAuthorizationService,
    private readonly matrixAuth: MatrixAuthorizationService,
    private readonly transactionManager: TransactionManagerPort,
    private readonly auditRepository: AuditEventRepositoryPort,
    private readonly outboxRepository: OutboxEventRepositoryPort,
  ) {}

  async execute(command: ReportExtensionBreachCommand): Promise<RentalRecord> {
    const context = await this.workContext.authorize({
      firebaseUid: command.firebaseUid,
      companyId: command.companyId,
      branchId: command.branchId,
    });

    await this.matrixAuth.assertAllowed(context.organizationId, context.roleId, 'RENTAL', 'REPORT_EXTENSION_BREACH', { companyId: context.companyId, branchId: context.branchId });

    const scope = {
      organizationId: context.organizationId,
      operatingCompanyId: command.companyId,
      branchId: command.branchId,
    };

    const existing = await this.rentals.findById(command.id, scope);
    if (!existing) {
      throw new NotFoundException('Alquiler no encontrado.');
    }
    if (existing.status !== 'EXTENSION_PENDING') {
      throw new RentalStateConflictError('registrar falta grave de ampliacion en', existing.status);
    }

    const pendingExtension = await this.rentals.findPendingExtensionByRentalId(existing.id);
    if (!pendingExtension) {
      throw new NotFoundException('No existe una solicitud de ampliacion pendiente para este alquiler.');
    }

    const legalEvaluationNote = command.notes
      ? `${LEGAL_EVALUATION_NOTE} Nota adicional: ${command.notes}`
      : LEGAL_EVALUATION_NOTE;

    return this.transactionManager.run(async (tx) => {
      const current = await this.rentals.findById(command.id, scope, tx);
      if (!current) {
        throw new NotFoundException('Alquiler no encontrado.');
      }
      if (current.status !== 'EXTENSION_PENDING') {
        throw new RentalStateConflictError('registrar falta grave de ampliacion en', current.status);
      }

      const currentExtension = await this.rentals.findPendingExtensionByRentalId(current.id, tx);
      if (!currentExtension) {
        throw new NotFoundException('No existe una solicitud de ampliacion pendiente para este alquiler.');
      }

      const updated = await this.rentals.reportExtensionBreach(
        {
          rentalId: command.id,
          scope,
          expectedVersion: command.expectedVersion,
          extensionId: currentExtension.id,
          customerId: current.customerId,
          legalEvaluationNote,
          updatedBy: command.firebaseUid,
        },
        tx,
      );

      await this.auditRepository.recordRentalEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.firebaseUid,
          rentalId: updated.id,
          action: 'EXTENSION_BREACH_REPORTED',
          changes: {
            extensionId: currentExtension.id,
            newExtensionStatus: 'BREACH',
            customerId: current.customerId,
            customerStatus: 'ROJO',
            depositFullyRetained: current.deposit != null,
            legalEvaluationNote,
          },
        },
        tx,
      );

      await this.outboxRepository.publish(
        {
          aggregateType: 'rental',
          aggregateId: updated.id,
          eventType: 'FaltaGraveAmpliacionRegistrada.v1',
          payload: {
            rentalId: updated.id,
            extensionId: currentExtension.id,
            customerId: current.customerId,
          },
        },
        tx,
      );

      return updated;
    });
  }
}
