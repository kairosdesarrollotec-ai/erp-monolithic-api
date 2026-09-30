import { Injectable, NotFoundException } from '@nestjs/common';
import { RentalRepositoryPort, RentalRecord } from '../ports/rental-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import { RentalStateConflictError } from '../../domain/rental-errors';
import { evaluateNotaryMatrix, NotaryEvaluationOutput } from '../policies/notary-matrix-policy';
import { EvaluateNotaryCommand } from './evaluate-notary.command';

export interface EvaluateNotaryResult {
  rental: RentalRecord;
  evaluation: NotaryEvaluationOutput;
}

/**
 * ALQ-05 / BR-ALQ-003 / BR-ALQ-004 - Evaluación Notarial y Tercer Camino.
 * Ejecuta matriz de decisión y transiciona a CONTRACTING salvo que requiera
 * aprobación explícita de excepción gerencial (THIRD_PATH_ELIGIBLE).
 */
@Injectable()
export class EvaluateNotaryHandler {
  constructor(
    private readonly rentals: RentalRepositoryPort,
    private readonly workContext: WorkContextAuthorizationService,
    private readonly matrixAuth: MatrixAuthorizationService,
    private readonly transactionManager: TransactionManagerPort,
    private readonly auditRepository: AuditEventRepositoryPort,
    private readonly outboxRepository: OutboxEventRepositoryPort,
  ) {}

  async execute(command: EvaluateNotaryCommand): Promise<EvaluateNotaryResult> {
    const context = await this.workContext.authorize({
      firebaseUid: command.firebaseUid,
      companyId: command.companyId,
      branchId: command.branchId,
    });

    await this.matrixAuth.assertAllowed(context.organizationId, context.role, 'RENTAL', 'EVALUATE_NOTARY');

    const scope = {
      organizationId: context.organizationId,
      operatingCompanyId: command.companyId,
      branchId: command.branchId,
    };

    const existing = await this.rentals.findById(command.id, scope);
    if (!existing) {
      throw new NotFoundException('Alquiler no encontrado.');
    }
    if (existing.status !== 'NOTARY_EVALUATION') {
      throw new RentalStateConflictError('evaluar notaría en', existing.status);
    }

    const vehicle = await this.rentals.findVehicleById(existing.vehicleId);
    if (!vehicle) {
      throw new NotFoundException('Vehículo del alquiler no encontrado.');
    }

    const customer = await this.rentals.findCustomerById(existing.customerId);
    const previousRentalsCount = await this.rentals.countPreviousRentalsByCustomer(
      existing.customerId,
      context.companyId,
    );

    const evaluation = evaluateNotaryMatrix({
      vehicleModel: vehicle.model,
      previousRentalsCount,
      biometricVerified: customer?.isBiometricVerified ?? false,
    });

    // Si no requiere aprobación previa (MANDATORY, DOUBLE_DEPOSIT), persiste la evaluación y transiciona a CONTRACTING
    if (!evaluation.requiresApproval) {
      const updated = await this.transactionManager.run(async (tx) => {
        await this.rentals.saveNotaryEvaluation(
          {
            rentalId: existing.id,
            policyVersion: evaluation.policyVersion,
            result: evaluation.result,
            reason: evaluation.reason,
          },
          tx,
        );

        const transitioned = await this.rentals.transitionStatus(
          existing.id,
          scope,
          'CONTRACTING',
          command.expectedVersion,
          command.firebaseUid,
          tx,
        );

        await this.auditRepository.recordRentalEvent(
          {
            organizationId: context.organizationId,
            actorUserId: command.firebaseUid,
            rentalId: existing.id,
            action: 'NOTARY_EVALUATED_AUTOMATIC',
            changes: {
              result: evaluation.result,
              reason: evaluation.reason,
              policyVersion: evaluation.policyVersion,
            },
          },
          tx,
        );

        return transitioned;
      });

      return { rental: updated, evaluation };
    }

    // Si es THIRD_PATH_ELIGIBLE, queda pendiente de aprobación gerencial (no transiciona todavía a CONTRACTING)
    return { rental: existing, evaluation };
  }
}
