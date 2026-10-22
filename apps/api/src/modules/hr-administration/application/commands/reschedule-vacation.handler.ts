import { Injectable } from '@nestjs/common';
import { Prisma, type VacationRequest } from '@prisma/client';
import { ClockPort } from '../../../../common/application/ports/clock.port';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { limaTodayString } from '../../../../common/time/lima-time';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { HrAdministrationAccessService } from '../services/hr-administration-access.service';
import { VacationRepositoryPort } from '../ports/vacation-repository.port';
import {
  EmployeeTerminatedError,
  InvalidDateRangeError,
  VacationDateInPastError,
  VacationNotFoundError,
  VacationRescheduleUnchangedError,
} from '../../domain/hr-administration-errors';
import {
  VACATION_CAPACITY_SCOPE,
  assertVacationChangeReason,
  assertVacationModifiable,
  validateVacationAreaCapacity,
} from '../../domain/hr-administration-rules';
import { RescheduleVacationCommand } from './reschedule-vacation.command';

const DATE_ONLY = (d: Date): string => d.toISOString().slice(0, 10);

/**
 * Respuestas 2026-10-22 #10: vacaciones en conflicto -> REPROGRAMAR a otra fecha libre (sin lista de espera). Valida con la MISMA regla de
 * capacidad que programar (BR-ADP-002: maximo 1 persona por area dentro de la misma empresa; parametros en `VACATION_MAX_CONCURRENT` /
 * `VACATION_CAPACITY_SCOPE`), excluyendo la propia solicitud, dentro de una transaccion Serializable (la EXCLUDE de BD por
 * empresa+area+fechas es la red final). Asigna de verdad el estado REPROGRAMADA, conserva las fechas originales y audita
 * (VACATION_RESCHEDULED con fechas previas/nuevas y motivo). Usa el permiso SCHEDULE_VACATION.
 */
@Injectable()
export class RescheduleVacationHandler {
  constructor(
    private readonly access: HrAdministrationAccessService,
    private readonly vacations: VacationRepositoryPort,
    private readonly transactionManager: TransactionManagerPort,
    private readonly clock: ClockPort,
    private readonly auditRepository: AuditEventRepositoryPort,
  ) {}

  async execute(command: RescheduleVacationCommand): Promise<VacationRequest> {
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
    if (command.startDate.getTime() > command.endDate.getTime()) {
      throw new InvalidDateRangeError();
    }
    if (DATE_ONLY(command.startDate) < limaTodayString(this.clock.now())) {
      throw new VacationDateInPastError();
    }

    return this.transactionManager.run(
      async (tx) => {
        const current = await this.vacations.findById(command.vacationId, tx);
        if (!current) {
          throw new VacationNotFoundError(command.vacationId);
        }
        assertVacationModifiable(current.id, current.status);
        if (DATE_ONLY(current.startDate) === DATE_ONLY(command.startDate) && DATE_ONLY(current.endDate) === DATE_ONLY(command.endDate)) {
          throw new VacationRescheduleUnchangedError();
        }
        // Un colaborador terminado ya no tiene vacaciones por reprogramar.
        if (current.employee.status === 'TERMINADO') {
          throw new EmployeeTerminatedError(current.employeeId);
        }

        const pool =
          VACATION_CAPACITY_SCOPE === 'COMPANY'
            ? await this.vacations.findActiveByCompany(current.operatingCompanyId, tx)
            : await this.vacations.findActiveByArea(current.operatingCompanyId, current.areaId, tx);

        validateVacationAreaCapacity(
          pool.map((v) => ({
            id: v.id,
            employeeId: v.employeeId,
            areaId: v.areaId,
            startDate: v.startDate,
            endDate: v.endDate,
            status: v.status,
            requestedAt: v.requestedAt,
          })),
          {
            id: current.id,
            employeeId: current.employeeId,
            areaId: current.areaId,
            startDate: command.startDate,
            endDate: command.endDate,
            status: 'SOLICITADA',
          },
          current.employee.areaName,
        );

        const now = this.clock.now();
        const updated = await this.vacations.reschedule(
          current.id,
          { startDate: command.startDate, endDate: command.endDate, reason, changedById: command.firebaseUid, changedAt: now },
          tx,
        );

        await this.auditRepository.recordHrAdministrationEvent(
          {
            organizationId: context.organizationId,
            actorUserId: command.firebaseUid,
            entityType: 'vacation',
            entityId: updated.id,
            action: 'VACATION_RESCHEDULED',
            changes: {
              employeeId: updated.employeeId,
              areaId: updated.areaId,
              previousStatus: current.status,
              status: updated.status,
              previousStartDate: current.startDate,
              previousEndDate: current.endDate,
              startDate: updated.startDate,
              endDate: updated.endDate,
              rescheduleCount: updated.rescheduleCount,
              reason,
            },
          },
          tx,
        );

        return updated;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}
