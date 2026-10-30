import { Injectable } from '@nestjs/common';
import type { FieldTripRequest } from '@prisma/client';
import { ClockPort } from '../../../../common/application/ports/clock.port';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { HrAdministrationAccessService } from '../services/hr-administration-access.service';
import { FieldTripCascadeService } from '../services/field-trip-cascade.service';
import { FieldTripAlertPublisher } from '../services/field-trip-alert.publisher';
import { EmployeeRepositoryPort } from '../ports/employee-repository.port';
import { FieldTripRepositoryPort } from '../ports/field-trip-repository.port';
import { UserDisplayNamePort } from '../ports/user-display-name.port';
import { FieldTripNotFoundError, FieldTripSelfApprovalError } from '../../domain/hr-administration-errors';
import { assertFieldTripRejectionReason } from '../../domain/hr-administration-rules';
import { RejectFieldTripCommand } from './reject-field-trip.command';

/**
 * ADP-07 / BR-ADP-004: un autorizador rechaza la salida con un motivo. El resultado es NO_AUTORIZADA (la persona no
 * sale) y no abre ningún nivel adicional. Lo decide el permiso AUTHORIZE_FIELD_TRIP, nunca el nombre de la persona.
 */
@Injectable()
export class RejectFieldTripHandler {
  constructor(
    private readonly access: HrAdministrationAccessService,
    private readonly fieldTrips: FieldTripRepositoryPort,
    private readonly cascade: FieldTripCascadeService,
    private readonly displayNames: UserDisplayNamePort,
    private readonly transactionManager: TransactionManagerPort,
    private readonly clock: ClockPort,
    private readonly auditRepository: AuditEventRepositoryPort,
    private readonly alerts: FieldTripAlertPublisher,
    private readonly employees: EmployeeRepositoryPort,
  ) {}

  async execute(command: RejectFieldTripCommand): Promise<FieldTripRequest> {
    const reason = assertFieldTripRejectionReason(command.reason);

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

    // El solicitante no resuelve su propia salida a campo: solo Gerencia u otro con permiso.
    const actorEmployee = await this.employees.findByFirebaseUid(found.employee.operatingCompanyId, command.firebaseUid);
    if (actorEmployee && actorEmployee.id === found.employee.id) {
      throw new FieldTripSelfApprovalError();
    }

    const userName = await this.displayNames.findDisplayName(command.firebaseUid);

    return this.transactionManager.run(async (tx) => {
      const rejected = await this.cascade.reject(
        {
          fieldTripId: command.fieldTripId,
          reason,
          userId: command.firebaseUid,
          userName,
          now: this.clock.now(),
        },
        tx,
      );

      await this.auditRepository.recordHrAdministrationEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.firebaseUid,
          entityType: 'field_trip',
          entityId: rejected.id,
          action: 'FIELD_TRIP_REJECTED',
          changes: {
            employeeId: rejected.employeeId,
            previousStatus: found.status,
            status: rejected.status,
            rejectedAtLevel: rejected.rejectedAtLevel,
            rejectionReason: rejected.rejectionReason,
            rejectedAt: rejected.rejectedAt,
          },
        },
        tx,
      );

      // 22-oct #4: rechazada explicitamente por un autorizador -> se retiran los avisos pendientes (no es «nadie autorizo»).
      await this.alerts.publish('RESOLVED', rejected, found.employee, tx, { outcome: 'RECHAZADA' });

      return rejected;
    });
  }
}
