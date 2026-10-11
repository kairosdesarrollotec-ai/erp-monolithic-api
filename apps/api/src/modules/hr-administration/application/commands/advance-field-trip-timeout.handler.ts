import { Injectable } from '@nestjs/common';
import type { FieldTripRequest } from '@prisma/client';
import { ClockPort } from '../../../../common/application/ports/clock.port';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { HrAdministrationAccessService } from '../services/hr-administration-access.service';
import { FieldTripCascadeService } from '../services/field-trip-cascade.service';
import { FieldTripRepositoryPort } from '../ports/field-trip-repository.port';
import { FieldTripNotFoundError } from '../../domain/hr-administration-errors';
import { AdvanceFieldTripTimeoutCommand } from './advance-field-trip-timeout.command';

export interface AdvanceFieldTripTimeoutResult {
  fieldTrip: FieldTripRequest;
  /** Solo cuando la cascada se agotó: nadie autorizó (NO_AUTORIZADA), sin 4to nivel automático. */
  message?: string;
}

/**
 * ADP-P13 / BR-ADP-004: escala la cascada cuando vence el temporizador de 5 min del nivel actual:
 * N1 -> N2 -> N3 -> NO_AUTORIZADA. NO existe un 4to nivel automático ni aprobación por defecto.
 */
@Injectable()
export class AdvanceFieldTripTimeoutHandler {
  constructor(
    private readonly access: HrAdministrationAccessService,
    private readonly fieldTrips: FieldTripRepositoryPort,
    private readonly cascade: FieldTripCascadeService,
    private readonly transactionManager: TransactionManagerPort,
    private readonly clock: ClockPort,
    private readonly auditRepository: AuditEventRepositoryPort,
  ) {}

  async execute(command: AdvanceFieldTripTimeoutCommand): Promise<AdvanceFieldTripTimeoutResult> {
    const found = await this.fieldTrips.findById(command.fieldTripId);
    if (!found) {
      throw new FieldTripNotFoundError(command.fieldTripId);
    }

    const { context } = await this.access.authorize(
      {
        firebaseUid: command.firebaseUid,
        companyId: found.employee.operatingCompanyId,
        branchId: found.employee.branchId,
      },
      'AUTHORIZE_FIELD_TRIP',
    );

    return this.transactionManager.run(async (tx) => {
      const result = await this.cascade.advanceTimeout(
        { fieldTripId: command.fieldTripId, now: this.clock.now() },
        tx,
      );

      await this.auditRepository.recordHrAdministrationEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.firebaseUid,
          entityType: 'field_trip',
          entityId: result.fieldTrip.id,
          action: result.fieldTrip.status === 'NO_AUTORIZADA' ? 'FIELD_TRIP_NOT_AUTHORIZED' : 'FIELD_TRIP_ESCALATED',
          changes: {
            employeeId: result.fieldTrip.employeeId,
            previousStatus: found.status,
            status: result.fieldTrip.status,
            level2TimeoutAt: result.fieldTrip.level2TimeoutAt,
            level3TimeoutAt: result.fieldTrip.level3TimeoutAt,
          },
        },
        tx,
      );

      return result;
    });
  }
}
