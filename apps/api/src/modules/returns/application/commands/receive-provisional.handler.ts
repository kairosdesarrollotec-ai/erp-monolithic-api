import { ReturnBellNotificationPort } from '../ports/return-bell-notification.port';
import { Injectable, Optional } from '@nestjs/common';
import { RentalRepositoryPort } from '../../../rentals/application/ports/rental-repository.port';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { ClockPort } from '../../../../common/application/ports/clock.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import { ReturnRecord, ReturnRepositoryPort } from '../ports/return-repository.port';
import { ReturnAccessService } from '../services/return-access.service';
import { ReturnAlertRecipientsPort } from '../ports/return-alert-recipients.port';
import { ReturnDashboardAlertPort } from '../ports/return-dashboard-alert.port';
import {
  RentalAlreadyHasActiveReturnError,
  RentalNotReturnableError,
  ReturnIdentityRequiredError,
  ReturnRentalNotFoundError,
} from '../../domain/return-errors';
import { isReturnableRentalStatus, appendNotes } from '../../domain/return-rules';
import { assertCanTransitionReturn } from '../../domain/return-status';
import { ReceiveProvisionalCommand } from './receive-provisional.command';

/**
 * DEV-03 / DR-DEV-003 - Recepción física provisional: VeloxRent toma custodia preventiva del vehículo
 * (kilometraje, combustible, presencia del cliente) sin cerrar la devolución contractual. Si ya existía un
 * expediente PROGRAMADA lo avanza; si no, lo crea directamente en RECEPCION_PROVISIONAL. El alquiler pasa a
 * RETURN_IN_PROGRESS (integración real con Rentals, en la misma transacción).
 */
@Injectable()
export class ReceiveProvisionalHandler {
  constructor(
    private readonly access: ReturnAccessService,
    private readonly returns: ReturnRepositoryPort,
    private readonly rentals: RentalRepositoryPort,
    private readonly transactionManager: TransactionManagerPort,
    private readonly clock: ClockPort,
    private readonly auditRepository: AuditEventRepositoryPort,
    private readonly outboxRepository: OutboxEventRepositoryPort,
    @Optional() private readonly recipients?: ReturnAlertRecipientsPort,
    @Optional() private readonly dashboardAlerts?: ReturnDashboardAlertPort,
    @Optional() private readonly bell?: ReturnBellNotificationPort,
  ) {}

  async execute(command: ReceiveProvisionalCommand): Promise<ReturnRecord> {
    const { context, scope } = await this.access.authorize(command, 'RECEIVE_PROVISIONAL');

    const preflight = await this.rentals.findById(command.rentalId, scope);
    if (!preflight) {
      throw new ReturnRentalNotFoundError(command.rentalId);
    }
    if (!isReturnableRentalStatus(preflight.status)) {
      throw new RentalNotReturnableError(preflight.status);
    }

    const now = this.clock.now();

    return this.transactionManager.run(async (tx) => {
      const rental = await this.rentals.findById(command.rentalId, scope, tx);
      if (!rental) {
        throw new ReturnRentalNotFoundError(command.rentalId);
      }
      if (!isReturnableRentalStatus(rental.status)) {
        throw new RentalNotReturnableError(rental.status);
      }

      const existing = await this.returns.findByRentalId(command.rentalId, scope, tx);
      if (
        command.identityVerified !== true ||
        !command.identityDocumentType?.trim() ||
        !command.identityDocumentNumber?.trim() ||
        typeof command.identityMatchesHolder !== 'boolean' ||
        !command.identityResult ||
        !['CONFORME', 'NO_CONFORME'].includes(command.identityResult)
      ) {
        throw new ReturnIdentityRequiredError();
      }

      const identityFields = {
        returnIdentityVerified: true,
        returnIdentityDocumentType: command.identityDocumentType.trim(),
        returnIdentityDocumentNumber: command.identityDocumentNumber.trim(),
        returnIdentityMatchesHolder: command.identityMatchesHolder,
        returnIdentityResult: command.identityResult,
        returnIdentityVerifiedAt: now,
        returnIdentityVerifiedBy: command.firebaseUid,
        returnIdentityNotes: command.observation?.trim() || null,
      };

      let received: ReturnRecord;
      if (!existing) {
        received = await this.returns.create(
          {
            organizationId: context.organizationId,
            operatingCompanyId: command.companyId,
            branchId: command.branchId,
            rentalId: rental.id,
            vehicleId: rental.vehicleId,
            customerId: rental.customerId,
            scheduledAt: now,
            status: 'RECEPCION_PROVISIONAL',
            custodyHolder: 'VELOXRENT',
            customerPresent: command.customerPresent ?? true,
            mileageAtReturn: command.mileageAtReturn,
            fuelLevelAtReturn: command.fuelLevelAtReturn,
            receivedAt: now,
            notes: command.notes,
            createdBy: command.firebaseUid,
            ...identityFields,
          },
          tx,
        );
      } else if (existing.status === 'PROGRAMADA') {
        assertCanTransitionReturn(existing.status, 'RECEPCION_PROVISIONAL');
        received = await this.returns.update(
          {
            id: existing.id,
            scope,
            expectedVersion: existing.version,
            status: 'RECEPCION_PROVISIONAL',
            custodyHolder: 'VELOXRENT',
            customerPresent: command.customerPresent ?? existing.customerPresent,
            mileageAtReturn: command.mileageAtReturn,
            fuelLevelAtReturn: command.fuelLevelAtReturn,
            receivedAt: now,
            notes: appendNotes(existing.notes, command.notes),
            updatedBy: command.firebaseUid,
            ...identityFields,
          },
          tx,
        );
      } else {
        throw new RentalAlreadyHasActiveReturnError(command.rentalId);
      }

      if (rental.status === 'ACTIVE') {
        await this.rentals.transitionStatus(
          rental.id,
          scope,
          'RETURN_IN_PROGRESS',
          rental.version,
          command.firebaseUid,
          tx,
        );
      }

      if (command.identityResult === 'NO_CONFORME') {
        await this.auditRepository.recordRentalEvent(
          {
            organizationId: context.organizationId,
            actorUserId: command.firebaseUid,
            rentalId: rental.id,
            action: 'RETURN_IDENTITY_NOT_CONFORME',
            changes: {
              returnId: received.id,
              documentType: command.identityDocumentType.trim(),
              documentNumber: command.identityDocumentNumber.trim(),
              matchesHolder: command.identityMatchesHolder,
              verifiedBy: command.firebaseUid,
              observation: command.observation?.trim() || null,
            },
          },
          tx,
        );

        if (this.recipients && this.dashboardAlerts) {
          try {
            const recipientRoles = await this.recipients.rolesWithAlertPermission(scope);
            const targetRoles = new Set(recipientRoles);
            targetRoles.add('GERENCIA');

            const docType = command.identityDocumentType?.trim() ?? 'DOCUMENTO';
            const docNum = command.identityDocumentNumber?.trim() ?? 'S/N';
            const alertItems = Array.from(targetRoles).map((role) => ({
              organizationId: context.organizationId,
              operatingCompanyId: command.companyId,
              branchId: command.branchId,
              role,
              itemType: 'ALERT' as const,
              priority: 95,
              title: `Recepción con documento NO CONFORME — ${received.vehiclePlate ?? 'Vehículo'}`,
              detail: `Recepción provisional con documento no conforme (${docType}: ${docNum}). Requiere revisión de Gerencia.${command.observation ? ` Obs: ${command.observation.trim()}` : ''}`,
              deepLink: `/devoluciones/${received.id}/cierre`,
              sourceType: 'RETURN' as const,
              sourceId: received.id,
              sourceEventId: `return-identity-mismatch:${received.id}:${role}`,
            }));

            await this.dashboardAlerts.createDashboardItems(alertItems);
            await this.bell?.notifyRoles({
              organizationId: context.organizationId,
              operatingCompanyId: command.companyId,
              branchId: command.branchId,
              roles: Array.from(targetRoles),
              notificationType: 'RETURN_IDENTITY_NOT_CONFORME',
              title: `Recepción con documento NO CONFORME — ${received.vehiclePlate ?? 'Vehículo'}`,
              deepLink: `/devoluciones/${received.id}/cierre`,
              sourceEventPrefix: `return-identity-mismatch-bell:${received.id}`,
            });
          } catch {
            // no bloqueante
          }
        }
      }

      await this.auditRepository.recordRentalEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.firebaseUid,
          rentalId: rental.id,
          action: 'RETURN_RECEIVED_PROVISIONALLY',
          changes: {
            returnId: received.id,
            mileageAtReturn: command.mileageAtReturn,
            fuelLevelAtReturn: command.fuelLevelAtReturn,
            customerPresent: received.customerPresent,
            custodyHolder: 'VELOXRENT',
          },
        },
        tx,
      );
      await this.outboxRepository.publish(
        {
          aggregateType: 'return',
          aggregateId: received.id,
          eventType: 'DevolucionRecibidaProvisional.v1',
          payload: {
            returnId: received.id,
            rentalId: rental.id,
            vehicleId: rental.vehicleId,
            receivedAt: now.toISOString(),
            organizationId: context.organizationId,
            operatingCompanyId: command.companyId,
            branchId: command.branchId,
          },
        },
        tx,
      );

      return received;
    });
  }
}
