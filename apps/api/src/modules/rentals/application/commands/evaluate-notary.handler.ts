import { Injectable, NotFoundException } from '@nestjs/common';
import { RentalRepositoryPort, RentalRecord } from '../ports/rental-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import { BiometricVerificationRequiredError, RentalStateConflictError } from '../../domain/rental-errors';
import { evaluateNotaryMatrix, NotaryEvaluationOutput } from '../policies/notary-matrix-policy';
import { depositMultiplierFor, requiredGuarantee, RequiredGuarantee } from '../../domain/guarantee-requirement';
import { EvaluateNotaryCommand } from './evaluate-notary.command';

export interface EvaluateNotaryResult {
  rental: RentalRecord;
  evaluation: NotaryEvaluationOutput & {
    /** Alquileres previos CERRADOS del cliente considerados (cliente antiguo = mas de 2). */
    previousRentalsCount: number;
    biometricVerified: boolean;
    vehicleThirdPathEligible: boolean;
    /** 2 si DOUBLE_DEPOSIT; 1 en el resto (la tercera via NO duplica garantia). */
    depositMultiplier: 1 | 2;
    /** Garantia exigida segun la tarifa de Flota y el resultado (null si el vehiculo no tiene garantia definida). */
    requiredGuarantee: RequiredGuarantee | null;
  };
}

/**
 * ALQ-05 / BR-ALQ-003 / BR-ALQ-004 - Evaluación Notarial y Tercera Vía.
 * Ejecuta la matriz de decisión y SIEMPRE persiste la evaluación (Russbel 22-oct-2026), también cuando requiere
 * aprobación de Gerencia (THIRD_PATH_ELIGIBLE / MANUAL_REVIEW): approve-notary-exception necesita la evaluación guardada
 * para registrar el tipo correcto. Transiciona a CONTRACTING solo si no requiere aprobación.
 *
 * Entradas: cliente antiguo = conteo de alquileres previos (>2) calculado en servidor; biométrico = casilla registrada por
 * el personal (auditada); vehículo de menor costo = marca `thirdPathEligible` de Flota (solo Gerencia la edita).
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

    await this.matrixAuth.assertAllowed(context.organizationId, context.roleId, 'RENTAL', 'EVALUATE_NOTARY', { companyId: context.companyId, branchId: context.branchId });

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

    // A-01: la casilla de biometria favorable es obligatoria para evaluar (antes se evaluaba sin marcarla).
    if (command.biometricVerified !== true) {
      throw new BiometricVerificationRequiredError();
    }

    const vehicle = await this.rentals.findVehicleById(existing.vehicleId);
    if (!vehicle) {
      throw new NotFoundException('Vehículo del alquiler no encontrado.');
    }

    const previousRentalsCount = await this.rentals.countPreviousRentalsByCustomer(
      existing.customerId,
      context.companyId,
    );
    const biometricVerified = command.biometricVerified === true;
    const thirdPathEligible = vehicle.thirdPathEligible === true;

    const policy = evaluateNotaryMatrix({
      vehicleModel: vehicle.model,
      previousRentalsCount,
      biometricVerified,
      thirdPathEligible,
    });
    const evaluation: EvaluateNotaryResult['evaluation'] = {
      ...policy,
      previousRentalsCount,
      biometricVerified,
      vehicleThirdPathEligible: thirdPathEligible,
      depositMultiplier: depositMultiplierFor(policy.result),
      requiredGuarantee: requiredGuarantee(vehicle.depositMinimum, policy.result),
    };

    const updated = await this.transactionManager.run(async (tx) => {
      await this.rentals.saveNotaryEvaluation(
        {
          rentalId: existing.id,
          policyVersion: policy.policyVersion,
          result: policy.result,
          reason: policy.reason,
          biometricVerified,
          biometricVerifiedBy: biometricVerified ? command.firebaseUid : undefined,
          previousRentalsCount,
        },
        tx,
      );

      const changes = {
        result: policy.result,
        reason: policy.reason,
        policyVersion: policy.policyVersion,
        previousRentalsCount,
        biometricVerified,
        vehicleThirdPathEligible: thirdPathEligible,
        depositMultiplier: evaluation.depositMultiplier,
        requiresApproval: policy.requiresApproval,
      };

      // Con aprobacion pendiente (THIRD_PATH_ELIGIBLE / MANUAL_REVIEW) el alquiler sigue en NOTARY_EVALUATION hasta que
      // Gerencia use approve-notary-exception; la evaluacion ya quedo guardada.
      if (policy.requiresApproval) {
        await this.auditRepository.recordRentalEvent(
          {
            organizationId: context.organizationId,
            actorUserId: command.firebaseUid,
            rentalId: existing.id,
            action: 'NOTARY_EVALUATED_PENDING_APPROVAL',
            changes,
          },
          tx,
        );
        return existing;
      }

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
          changes,
        },
        tx,
      );

      return transitioned;
    });

    // Se devuelve el alquiler con la evaluacion recien guardada.
    const refreshed = (await this.rentals.findById(existing.id, scope)) ?? updated;
    return { rental: refreshed, evaluation };
  }
}
