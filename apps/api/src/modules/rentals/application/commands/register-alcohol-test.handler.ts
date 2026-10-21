import { Injectable, NotFoundException } from '@nestjs/common';
import { RentalRepositoryPort, RentalRecord } from '../ports/rental-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import { AlcoholTestPhotoRequiredError, RentalStateConflictError } from '../../domain/rental-errors';
import {
  alcoholTestRequiresPhoto,
  isAlcoholTestPassing,
  RENTAL_ALCOHOL_TEST_EVIDENCE_ZONE,
} from '../../domain/alcohol-test-result';
import { RentalEvidenceRepositoryPort } from '../ports/rental-evidence-repository.port';
import { RegisterAlcoholTestCommand } from './register-alcohol-test.command';

/**
 * ALQ-04 / BR-ALQ-005 - Registro obligatorio de prueba de alcolímetro (tolerancia cero).
 * Favorable -> NOTARY_EVALUATION.
 * Desfavorable o Rechazado -> CANCELLED (cancelación irreversible con auditoría).
 * ENTREGA-02 (Respuestas 2026-10-20 #10): igual que la devolución, DESFAVORABLE/RECHAZADO = check «no cumple rango» +
 * FOTO obligatoria (evidencia PHOTO zona ALCOHOL_TEST subida antes, sin hora); sin foto -> 422 ALCOHOL_TEST_PHOTO_REQUIRED.
 */
@Injectable()
export class RegisterAlcoholTestHandler {
  constructor(
    private readonly rentals: RentalRepositoryPort,
    private readonly workContext: WorkContextAuthorizationService,
    private readonly matrixAuth: MatrixAuthorizationService,
    private readonly transactionManager: TransactionManagerPort,
    private readonly auditRepository: AuditEventRepositoryPort,
    private readonly outboxRepository: OutboxEventRepositoryPort,
    private readonly evidenceRepository: RentalEvidenceRepositoryPort,
  ) {}

  async execute(command: RegisterAlcoholTestCommand): Promise<RentalRecord> {
    const context = await this.workContext.authorize({
      firebaseUid: command.firebaseUid,
      companyId: command.companyId,
      branchId: command.branchId,
    });

    await this.matrixAuth.assertAllowed(context.organizationId, context.roleId, 'RENTAL', 'REGISTER_ALCOHOL_TEST', { companyId: context.companyId, branchId: context.branchId });

    const scope = {
      organizationId: context.organizationId,
      operatingCompanyId: command.companyId,
      branchId: command.branchId,
    };

    const existing = await this.rentals.findById(command.id, scope);
    if (!existing) {
      throw new NotFoundException('Alquiler no encontrado.');
    }
    if (existing.status !== 'VALIDATION') {
      throw new RentalStateConflictError('registrar alcolímetro en', existing.status);
    }

    const isPassing = isAlcoholTestPassing(command.result);
    const targetStatus = isPassing ? 'NOTARY_EVALUATION' : 'CANCELLED';

    return this.transactionManager.run(async (tx) => {
      const current = await this.rentals.findById(command.id, scope, tx);
      if (!current) {
        throw new NotFoundException('Alquiler no encontrado.');
      }
      if (current.status !== 'VALIDATION') {
        throw new RentalStateConflictError('registrar alcolímetro en', current.status);
      }

      let alcoholPhotoEvidenceId: string | undefined;
      if (alcoholTestRequiresPhoto(command.result)) {
        const evidences = await this.evidenceRepository.list(command.id, scope);
        const photo = evidences.find((e) => e.type === 'PHOTO' && e.zone === RENTAL_ALCOHOL_TEST_EVIDENCE_ZONE);
        if (!photo) {
          throw new AlcoholTestPhotoRequiredError();
        }
        alcoholPhotoEvidenceId = photo.id;
      }

      const updated = await this.rentals.saveAlcoholTest(
        {
          id: command.id,
          scope,
          expectedVersion: command.expectedVersion,
          result: command.result,
          updatedBy: command.firebaseUid,
        },
        tx,
      );

      await this.auditRepository.recordRentalEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.firebaseUid,
          rentalId: updated.id,
          action: isPassing ? 'ALCOHOL_TEST_PASSED' : 'ALCOHOL_TEST_FAILED_RENTAL_CANCELLED',
          changes: {
            result: command.result,
            targetStatus,
            alcoholPhotoEvidenceId,
            notes: command.notes,
          },
        },
        tx,
      );

      await this.outboxRepository.publish(
        {
          aggregateType: 'rental',
          aggregateId: updated.id,
          eventType: isPassing ? 'AlcoholTestPassed.v1' : 'AlcoholTestFailed.v1',
          payload: {
            rentalId: updated.id,
            result: command.result,
            alcoholPhotoEvidenceId: alcoholPhotoEvidenceId ?? null,
            status: updated.status,
            organizationId: context.organizationId,
            operatingCompanyId: context.companyId,
            branchId: context.branchId,
          },
        },
        tx,
      );

      return updated;
    });
  }
}
