import { Injectable } from '@nestjs/common';
import type { FieldTripRequest } from '@prisma/client';
import { ClockPort } from '../../../../common/application/ports/clock.port';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { HrAdministrationAccessService } from '../services/hr-administration-access.service';
import { FieldTripCascadeService } from '../services/field-trip-cascade.service';
import { FieldTripAlertPublisher } from '../services/field-trip-alert.publisher';
import { FieldTripRepositoryPort } from '../ports/field-trip-repository.port';
import { UserDisplayNamePort } from '../ports/user-display-name.port';
import {
  FieldTripLevelRoleMismatchError,
  FieldTripNotFoundError,
} from '../../domain/hr-administration-errors';
import { validateAuthorizationLevel } from '../../domain/hr-administration-rules';
import { AuthorizeFieldTripCommand } from './authorize-field-trip.command';

/**
 * ADP-P13 / BR-ADP-004: autoriza la salida en un nivel de la cascada (1, 2 o 3; nunca un 4to). Quién puede hacerlo lo
 * define el permiso AUTHORIZE_FIELD_TRIP de la matriz dinámica, nunca el nombre de la persona.
 */
@Injectable()
export class AuthorizeFieldTripHandler {
  constructor(
    private readonly access: HrAdministrationAccessService,
    private readonly fieldTrips: FieldTripRepositoryPort,
    private readonly cascade: FieldTripCascadeService,
    private readonly displayNames: UserDisplayNamePort,
    private readonly transactionManager: TransactionManagerPort,
    private readonly clock: ClockPort,
    private readonly auditRepository: AuditEventRepositoryPort,
    private readonly alerts: FieldTripAlertPublisher,
  ) {}

  async execute(command: AuthorizeFieldTripCommand): Promise<FieldTripRequest> {
    validateAuthorizationLevel(command.authorizationLevel);

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

    // DEC-ADP-FIELD-TRIP-001: Nivel 1 y 2 = Gerencia; Nivel 3 = Administracion (Cecilia) o Gerencia.
    if (command.authorizationLevel < 3 && context.roleKey === 'ADMINISTRACION') {
      throw new FieldTripLevelRoleMismatchError(command.authorizationLevel, context.roleKey);
    }

    const userName = await this.displayNames.findDisplayName(command.firebaseUid);

    return this.transactionManager.run(async (tx) => {
      const authorized = await this.cascade.authorize(
        {
          fieldTripId: command.fieldTripId,
          authorizationLevel: command.authorizationLevel,
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
          entityId: authorized.id,
          action: 'FIELD_TRIP_AUTHORIZED',
          changes: {
            employeeId: authorized.employeeId,
            authorizationLevel: authorized.authorizationLevel,
            status: authorized.status,
            authorizedAt: authorized.authorizedAt,
            notes: command.notes?.trim() || null,
          },
        },
        tx,
      );

      // 22-oct #4: autorizada -> se retiran los avisos pendientes de esta salida.
      await this.alerts.publish('RESOLVED', authorized, found.employee, tx, { outcome: 'AUTORIZADA' });

      return authorized;
    });
  }
}
