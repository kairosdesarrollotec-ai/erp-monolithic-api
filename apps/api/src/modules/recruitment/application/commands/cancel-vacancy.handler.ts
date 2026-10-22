import { Injectable } from '@nestjs/common';
import { ClockPort } from '../../../../common/application/ports/clock.port';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { RecruitmentAccessService } from '../services/recruitment-access.service';
import { VacancyDetailRecord, VacancyRepositoryPort } from '../ports/vacancy-repository.port';
import { VacancyNotFoundError } from '../../domain/recruitment-errors';
import { assertVacancyCancellable, assertVacancyCancelReason } from '../../domain/recruitment-rules';
import { CancelVacancyCommand } from './cancel-vacancy.command';

/**
 * REC-02 «Cancelar» (22-oct, Respuestas P2): NECESIDAD_REGISTRADA / PUBLICADA / PAUSADA -> CANCELADA con motivo obligatorio
 * (If-Match, permiso RECRUITMENT.CANCEL_VACANCY editable en ADM-02, auditoria VACANCY_CANCELLED). No borra nada: los candidatos
 * de la vacante permanecen consultables (la fila y sus relaciones siguen).
 */
@Injectable()
export class CancelVacancyHandler {
  constructor(
    private readonly access: RecruitmentAccessService,
    private readonly vacancies: VacancyRepositoryPort,
    private readonly transactionManager: TransactionManagerPort,
    private readonly clock: ClockPort,
    private readonly auditRepository: AuditEventRepositoryPort,
  ) {}

  async execute(command: CancelVacancyCommand): Promise<VacancyDetailRecord> {
    const { context, scope } = await this.access.authorize(
      { firebaseUid: command.firebaseUid, companyId: command.companyId, branchId: command.branchId },
      'CANCEL_VACANCY',
    );
    const reason = assertVacancyCancelReason(command.reason);

    return this.transactionManager.run(async (tx) => {
      const existing = await this.vacancies.findById(command.id, scope, tx);
      if (!existing) {
        throw new VacancyNotFoundError(command.id);
      }
      assertVacancyCancellable(existing.status);

      const cancelled = await this.vacancies.cancel(
        command.id,
        { reason, cancelledBy: command.firebaseUid, cancelledAt: this.clock.now() },
        command.expectedVersion,
        tx,
      );

      await this.auditRepository.recordRecruitmentEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.firebaseUid,
          entityType: 'vacancy',
          entityId: cancelled.id,
          action: 'VACANCY_CANCELLED',
          changes: {
            fromStatus: existing.status,
            toStatus: cancelled.status,
            reason,
            version: cancelled.version,
          },
        },
        tx,
      );

      const detail = await this.vacancies.findDetailById(command.id, scope, tx);
      if (!detail) {
        throw new VacancyNotFoundError(command.id);
      }
      return detail;
    });
  }
}
