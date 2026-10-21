import { Injectable } from '@nestjs/common';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import { ReturnRecord, ReturnRepositoryPort } from '../ports/return-repository.port';
import { ReturnAccessService } from '../services/return-access.service';
import { AlcoholTestPhotoRequiredError, ReturnNotFoundError, ReturnStateConflictError } from '../../domain/return-errors';
import { RETURN_ALCOHOL_TEST_EVIDENCE_ZONE } from '../../domain/return-evidence-requirements';
import { assertCanTransitionReturn } from '../../domain/return-status';
import { RegisterReturnAlcoholTestCommand } from './register-alcohol-test.command';

/**
 * DEV-04 / BR-DEV-005 / DR-DEV-003 - Alcolímetro de salida (tolerancia cero).
 * FAVORABLE -> INSPECCION. DESFAVORABLE/RECHAZADO -> el expediente PERMANECE en RECEPCION_PROVISIONAL, el
 * vehículo sigue en custodia preventiva de VeloxRent y se escala a Gerencia (evento EscaladoAGerencia.v1). El
 * comando no falla en ese caso: el resultado queda registrado (200).
 * Fiorella 2026-10-16: DESFAVORABLE = check "no cumple rango" + FOTO de la prueba obligatoria (evidencia PHOTO con zona
 * ALCOHOL_TEST subida antes); sin foto -> 422 ALCOHOL_TEST_PHOTO_REQUIRED. No se registra hora ni otros campos.
 * RECHAZADO (16/19-oct, Russbel): la foto de la prueba tambien se sube y es obligatoria, como evidencia "por si acaso".
 */
@Injectable()
export class RegisterReturnAlcoholTestHandler {
  constructor(
    private readonly access: ReturnAccessService,
    private readonly returns: ReturnRepositoryPort,
    private readonly transactionManager: TransactionManagerPort,
    private readonly auditRepository: AuditEventRepositoryPort,
    private readonly outboxRepository: OutboxEventRepositoryPort,
  ) {}

  async execute(command: RegisterReturnAlcoholTestCommand): Promise<ReturnRecord> {
    const { context, scope } = await this.access.authorize(command, 'REGISTER_ALCOHOL_TEST');

    const existing = await this.returns.findById(command.id, scope);
    if (!existing) {
      throw new ReturnNotFoundError(command.id);
    }
    if (existing.status !== 'RECEPCION_PROVISIONAL') {
      throw new ReturnStateConflictError('registrar alcolímetro en', existing.status);
    }

    const passing = command.result === 'FAVORABLE';

    return this.transactionManager.run(async (tx) => {
      const current = await this.returns.findById(command.id, scope, tx);
      if (!current) {
        throw new ReturnNotFoundError(command.id);
      }
      if (current.status !== 'RECEPCION_PROVISIONAL') {
        throw new ReturnStateConflictError('registrar alcolímetro en', current.status);
      }
      if (passing) {
        assertCanTransitionReturn(current.status, 'INSPECCION');
      }
      let alcoholPhotoEvidenceId: string | undefined;
      if (command.result === 'DESFAVORABLE' || command.result === 'RECHAZADO') {
        const evidences = await this.returns.listEvidences(command.id, scope);
        const photo = evidences.find((e) => e.type === 'PHOTO' && e.zone === RETURN_ALCOHOL_TEST_EVIDENCE_ZONE);
        if (!photo) {
          throw new AlcoholTestPhotoRequiredError();
        }
        alcoholPhotoEvidenceId = photo.id;
      }

      const updated = await this.returns.update(
        {
          id: command.id,
          scope,
          expectedVersion: command.expectedVersion,
          status: passing ? 'INSPECCION' : undefined,
          custodyHolder: 'VELOXRENT',
          alcoholTestResult: command.result,
          alcoholTestNotes: command.notes,
          updatedBy: command.firebaseUid,
        },
        tx,
      );

      await this.auditRepository.recordRentalEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.firebaseUid,
          rentalId: updated.rentalId,
          action: passing ? 'RETURN_ALCOHOL_TEST_PASSED' : 'RETURN_ALCOHOL_TEST_FAILED_ESCALATED',
          changes: {
            returnId: updated.id,
            result: command.result,
            notes: command.notes,
            alcoholPhotoEvidenceId,
            newStatus: updated.status,
            escalatedTo: passing ? undefined : 'GERENCIA',
          },
        },
        tx,
      );
      await this.outboxRepository.publish(
        {
          aggregateType: 'return',
          aggregateId: updated.id,
          eventType: passing ? 'DevolucionAlcoholFavorable.v1' : 'EscaladoAGerencia.v1',
          payload: {
            returnId: updated.id,
            rentalId: updated.rentalId,
            result: command.result,
            alcoholPhotoEvidenceId: alcoholPhotoEvidenceId ?? null,
            status: updated.status,
            escalatedTo: passing ? null : 'GERENCIA',
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
