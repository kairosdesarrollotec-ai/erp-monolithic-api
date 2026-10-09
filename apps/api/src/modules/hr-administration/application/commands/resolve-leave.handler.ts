import { Injectable } from '@nestjs/common';
import type { LeaveRequest } from '@prisma/client';
import { ClockPort } from '../../../../common/application/ports/clock.port';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { HrAdministrationAccessService } from '../services/hr-administration-access.service';
import { LeaveRepositoryPort } from '../ports/leave-repository.port';
import { UserDisplayNamePort } from '../ports/user-display-name.port';
import {
  InvalidLeaveResolutionError,
  LeaveAlreadyResolvedError,
  LeaveNotFoundError,
} from '../../domain/hr-administration-errors';
import { ResolveLeaveCommand } from './resolve-leave.command';

/**
 * ADP-P06 / BR-ADP-003: autorizar o denegar un permiso es exclusivo de quien tenga el permiso AUTHORIZE_LEAVE en la
 * matriz (hoy Fiorella o José): la regla NUNCA se decide por nombre ni por rol hard-coded.
 * Estados: Solicitado -> Autorizado | Denegado (BDD 11.7).
 */
@Injectable()
export class ResolveLeaveHandler {
  constructor(
    private readonly access: HrAdministrationAccessService,
    private readonly leaves: LeaveRepositoryPort,
    private readonly displayNames: UserDisplayNamePort,
    private readonly transactionManager: TransactionManagerPort,
    private readonly clock: ClockPort,
    private readonly auditRepository: AuditEventRepositoryPort,
  ) {}

  async execute(command: ResolveLeaveCommand): Promise<LeaveRequest> {
    if (command.status !== 'AUTORIZADO' && command.status !== 'DENEGADO') {
      throw new InvalidLeaveResolutionError();
    }

    const found = await this.leaves.findById(command.leaveId);
    if (!found) {
      throw new LeaveNotFoundError(command.leaveId);
    }

    const { context } = await this.access.authorize(
      {
        firebaseUid: command.firebaseUid,
        companyId: found.employee.operatingCompanyId,
        branchId: found.employee.branchId,
      },
      'AUTHORIZE_LEAVE',
    );

    if (found.status !== 'SOLICITADO') {
      throw new LeaveAlreadyResolvedError(command.leaveId);
    }

    const authorizerName = await this.displayNames.findDisplayName(command.firebaseUid);

    return this.transactionManager.run(async (tx) => {
      const resolved = await this.leaves.resolve(
        command.leaveId,
        {
          status: command.status,
          authorizedById: command.firebaseUid,
          authorizedByName: authorizerName,
          resolutionNotes: command.resolutionNotes?.trim() || null,
          resolvedAt: this.clock.now(),
        },
        tx,
      );

      await this.auditRepository.recordHrAdministrationEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.firebaseUid,
          entityType: 'leave',
          entityId: resolved.id,
          action: 'LEAVE_RESOLVED',
          changes: {
            employeeId: resolved.employeeId,
            status: resolved.status,
            resolutionNotes: resolved.resolutionNotes,
            resolvedAt: resolved.resolvedAt,
          },
        },
        tx,
      );

      return resolved;
    });
  }
}
