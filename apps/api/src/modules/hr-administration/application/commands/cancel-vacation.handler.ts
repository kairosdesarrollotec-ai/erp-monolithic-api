import { Injectable } from '@nestjs/common';
import type { VacationRequest } from '@prisma/client';
import { ClockPort } from '../../../../common/application/ports/clock.port';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { HrAdministrationAccessService } from '../services/hr-administration-access.service';
import { VacationRepositoryPort } from '../ports/vacation-repository.port';
import { VacationNotFoundError } from '../../domain/hr-administration-errors';
import { assertVacationChangeReason, assertVacationModifiable } from '../../domain/hr-administration-rules';
import { CancelVacationCommand } from './cancel-vacation.command';

/**
 * Respuestas 2026-10-22 #10: cancelar vacaciones (estado CANCELADA, libera el cupo del area) con motivo obligatorio y auditoria
 * (VACATION_CANCELLED). Solo SOLICITADA / PROGRAMADA / REPROGRAMADA. Permiso SCHEDULE_VACATION.
 */
@Injectable()
export class CancelVacationHandler {
  constructor(
    private readonly access: HrAdministrationAccessService,
    private readonly vacations: VacationRepositoryPort,
    private readonly transactionManager: TransactionManagerPort,
    private readonly clock: ClockPort,
    private readonly auditRepository: AuditEventRepositoryPort,
  ) {}

  async execute(command: CancelVacationCommand): Promise<VacationRequest> {
    const found = await this.vacations.findById(command.vacationId);
    if (!found) {
      throw new VacationNotFoundError(command.vacationId);
    }

    const { context } = await this.access.authorize(
      {
        firebaseUid: command.firebaseUid,
        companyId: found.employee.operatingCompanyId,
        branchId: found.employee.branchId,
      },
      'SCHEDULE_VACATION',
    );

    const reason = assertVacationChangeReason(command.reason);

    return this.transactionManager.run(async (tx) => {
      const current = await this.vacations.findById(command.vacationId, tx);
      if (!current) {
        throw new VacationNotFoundError(command.vacationId);
      }
      assertVacationModifiable(current.id, current.status);

      const updated = await this.vacations.cancel(
        current.id,
        { reason, changedById: command.firebaseUid, changedAt: this.clock.now() },
        tx,
      );

      await this.auditRepository.recordHrAdministrationEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.firebaseUid,
          entityType: 'vacation',
          entityId: updated.id,
          action: 'VACATION_CANCELLED',
          changes: {
            employeeId: updated.employeeId,
            areaId: updated.areaId,
            previousStatus: current.status,
            status: updated.status,
            startDate: updated.startDate,
            endDate: updated.endDate,
            reason,
          },
        },
        tx,
      );

      return updated;
    });
  }
}
