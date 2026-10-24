import { Injectable } from '@nestjs/common';
import { Prisma, type VacationRequest } from '@prisma/client';
import { ClockPort } from '../../../../common/application/ports/clock.port';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { HrAdministrationAccessService } from '../services/hr-administration-access.service';
import { VacationRepositoryPort } from '../ports/vacation-repository.port';
import {
  InvalidGrantedDaysError,
  VacationAlreadyResolvedError,
  VacationNotFoundError,
} from '../../domain/hr-administration-errors';
import {
  assertVacationChangeReason,
  validateVacationAreaCapacity,
} from '../../domain/hr-administration-rules';
import { ResolveVacationCommand } from './resolve-vacation.command';

/**
 * R4: Resolución de solicitud de vacaciones por Gerencia.
 * - Soporta otorgar menos días de los solicitados (grantedDays).
 * - En estado PROGRAMADA valida cupo por empresa (máximo 1 persona a la vez, BR-ADP-002, DEC-ADP-VAC-001).
 * - Soporta rechazo/cancelación o reprogramación con motivo obligatorio.
 */
@Injectable()
export class ResolveVacationHandler {
  constructor(
    private readonly access: HrAdministrationAccessService,
    private readonly vacations: VacationRepositoryPort,
    private readonly transactionManager: TransactionManagerPort,
    private readonly clock: ClockPort,
    private readonly auditRepository: AuditEventRepositoryPort,
  ) {}

  async execute(command: ResolveVacationCommand): Promise<VacationRequest> {
    const found = await this.vacations.findById(command.vacationId);
    if (!found) {
      throw new VacationNotFoundError(command.vacationId);
    }

    const { context } = await this.access.authorizeAny(
      {
        firebaseUid: command.firebaseUid,
        companyId: found.employee.operatingCompanyId,
        branchId: found.employee.branchId,
      },
      ['SCHEDULE_VACATION', 'AUTHORIZE_LEAVE'],
    );

    return this.transactionManager.run(
      async (tx) => {
        const current = await this.vacations.findById(command.vacationId, tx);
        if (!current) {
          throw new VacationNotFoundError(command.vacationId);
        }

        if (command.status === 'PROGRAMADA') {
          if (current.status === 'CANCELADA') {
            throw new VacationAlreadyResolvedError(current.id);
          }

          const requestedDays =
            Math.round((current.endDate.getTime() - current.startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

          if (command.grantedDays != null) {
            if (command.grantedDays < 1 || command.grantedDays > requestedDays) {
              throw new InvalidGrantedDaysError(
                `Los días otorgados (${command.grantedDays}) deben estar entre 1 y los días solicitados (${requestedDays}).`,
              );
            }
          }

          const grantedDays = command.grantedDays ?? requestedDays;
          const newEndDate = new Date(current.startDate.getTime() + (grantedDays - 1) * 24 * 60 * 60 * 1000);

          const activeInCompany = await this.vacations.findActiveByCompany(current.employee.operatingCompanyId, tx);
          validateVacationAreaCapacity(
            activeInCompany
              .filter((v) => v.id !== current.id)
              .map((v) => ({
                id: v.id,
                employeeId: v.employeeId,
                areaId: v.areaId,
                startDate: v.startDate,
                endDate: v.endDate,
                status: v.status,
                requestedAt: v.requestedAt,
              })),
            {
              employeeId: current.employeeId,
              areaId: current.areaId,
              startDate: current.startDate,
              endDate: newEndDate,
              status: 'PROGRAMADA',
            },
            current.employee.areaName,
          );

          const now = this.clock.now();
          const updated = await this.vacations.resolve(
            current.id,
            {
              status: 'PROGRAMADA',
              grantedDays,
              endDate: newEndDate,
              approvedById: command.firebaseUid,
              approvedAt: now,
              statusReason: command.statusReason?.trim() || null,
              statusChangedById: command.firebaseUid,
              statusChangedAt: now,
            },
            tx,
          );

          await this.auditRepository.recordHrAdministrationEvent(
            {
              organizationId: context.organizationId,
              actorUserId: command.firebaseUid,
              entityType: 'vacation',
              entityId: updated.id,
              action: 'VACATION_RESOLVED',
              changes: {
                employeeId: updated.employeeId,
                areaId: updated.areaId,
                previousStatus: current.status,
                status: updated.status,
                startDate: updated.startDate,
                endDate: updated.endDate,
                grantedDays,
              },
            },
            tx,
          );

          return updated;
        }

        if (command.status === 'CANCELADA') {
          const reason = assertVacationChangeReason(command.statusReason);
          const now = this.clock.now();

          const updated = await this.vacations.resolve(
            current.id,
            {
              status: 'CANCELADA',
              statusReason: reason,
              statusChangedById: command.firebaseUid,
              statusChangedAt: now,
            },
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
                reason,
              },
            },
            tx,
          );

          return updated;
        }

        // status === 'REPROGRAMADA'
        const reason = assertVacationChangeReason(command.statusReason);
        const now = this.clock.now();

        const updated = await this.vacations.resolve(
          current.id,
          {
            status: 'REPROGRAMADA',
            statusReason: reason,
            statusChangedById: command.firebaseUid,
            statusChangedAt: now,
          },
          tx,
        );

        await this.auditRepository.recordHrAdministrationEvent(
          {
            organizationId: context.organizationId,
            actorUserId: command.firebaseUid,
            entityType: 'vacation',
            entityId: updated.id,
            action: 'VACATION_REPROGRAMMED',
            changes: {
              employeeId: updated.employeeId,
              areaId: updated.areaId,
              previousStatus: current.status,
              status: updated.status,
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
