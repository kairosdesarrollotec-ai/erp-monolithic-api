import { Injectable, NotFoundException } from '@nestjs/common';
import { RentalRepositoryPort, RentalRecord } from '../ports/rental-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import { RentalStateConflictError } from '../../domain/rental-errors';
import { isAlcoholTestPassing } from '../../domain/alcohol-test-result';
import { RegisterAlcoholTestCommand } from './register-alcohol-test.command';

/**
 * ALQ-04 / BR-ALQ-005 - Registro obligatorio de prueba de alcolímetro (tolerancia cero).
 * Favorable -> NOTARY_EVALUATION.
 * Desfavorable o Rechazado -> CANCELLED (cancelación irreversible con auditoría).
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
