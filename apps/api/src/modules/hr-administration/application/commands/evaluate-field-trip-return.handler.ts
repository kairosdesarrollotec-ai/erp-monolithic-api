import { Injectable } from '@nestjs/common';
import type { FieldTripRequest, HrMemo } from '@prisma/client';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { HrAdministrationAccessService } from '../services/hr-administration-access.service';
import { FieldTripCascadeService } from '../services/field-trip-cascade.service';
import { HrMemoService } from '../services/hr-memo.service';
import { FieldTripRepositoryPort } from '../ports/field-trip-repository.port';
import { FieldTripNotFoundError } from '../../domain/hr-administration-errors';
import { EvaluateFieldTripReturnCommand } from './evaluate-field-trip-return.command';

export interface EvaluateFieldTripReturnResult {
  fieldTrip: FieldTripRequest;
  isLate: boolean;
  lateMinutes: number;
  /** Contador acumulado de incumplimientos del colaborador tras esta evaluación. */
  lateCount: number;
  isObserved: boolean;
  message: string;
  /** Memo de advertencia generado AUTOMÁTICAMENTE por la reincidencia (4ª tardanza en adelante), si corresponde. */
  memo: HrMemo | null;
}

/**
 * ADP-P14 / BR-ADP-005: 1ª a 3ª vez que no regresa a tiempo = advertencia (CERRADA_NORMAL); desde la 4ª la salida
 * queda OBSERVADA, el colaborador "observado" y el sistema genera SOLO el memo de advertencia.
 */
@Injectable()
export class EvaluateFieldTripReturnHandler {
  constructor(
    private readonly access: HrAdministrationAccessService,
    private readonly fieldTrips: FieldTripRepositoryPort,
    private readonly cascade: FieldTripCascadeService,
    private readonly transactionManager: TransactionManagerPort,
    private readonly auditRepository: AuditEventRepositoryPort,
    private readonly memos: HrMemoService,
  ) {}

  async execute(command: EvaluateFieldTripReturnCommand): Promise<EvaluateFieldTripReturnResult> {
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
      'EVALUATE_FIELD_TRIP_RETURN',
    );

    return this.transactionManager.run(async (tx) => {
      const outcome = await this.cascade.evaluateReturn(
        {
          fieldTripId: command.fieldTripId,
          actualReturn: command.actualReturn,
          returnNotes: command.returnNotes?.trim() || null,
        },
        tx,
      );

      await this.auditRepository.recordHrAdministrationEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.firebaseUid,
          entityType: 'field_trip',
          entityId: outcome.fieldTrip.id,
          action: 'FIELD_TRIP_RETURN_EVALUATED',
          changes: {
            employeeId: outcome.fieldTrip.employeeId,
            status: outcome.fieldTrip.status,
            actualReturn: outcome.fieldTrip.actualReturn,
            lateMinutes: outcome.lateMinutes,
            lateCount: outcome.newLateCount,
            isObserved: outcome.isObserved,
          },
        },
        tx,
      );

      const memo = outcome.isLate
        ? await this.memos.onFieldTripLateReturn(
            {
              organizationId: context.organizationId,
              employeeId: outcome.fieldTrip.employeeId,
              fieldTripId: outcome.fieldTrip.id,
              destination: outcome.fieldTrip.destination,
              newLateCount: outcome.newLateCount,
              lateMinutes: outcome.lateMinutes,
              issuedOn: command.actualReturn,
            },
            tx,
          )
        : null;

      return {
        fieldTrip: outcome.fieldTrip,
        isLate: outcome.isLate,
        lateMinutes: outcome.lateMinutes,
        lateCount: outcome.newLateCount,
        isObserved: outcome.isObserved,
        message: memo ? `${outcome.message} Se generó automáticamente el memo de advertencia.` : outcome.message,
        memo,
      };
    });
  }
}
