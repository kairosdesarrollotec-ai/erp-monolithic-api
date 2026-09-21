import { Injectable, NotFoundException } from '@nestjs/common';
import { ReservationRepositoryPort, ReservationRecord } from '../ports/reservation-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { RequirementsIncompleteError, ReservationStateConflictError } from '../../domain/reservation-errors';
import { ConfirmReservationCommand } from './confirm-reservation.command';

/**
 * RES-P11 (BR-RES-009, DR-RES-002) - UC-RES-002 del SDD, seccion 10.1 del
 * TDD. El bloqueo del vehiculo es un UNICO evento atomico que ocurre
 * solo cuando pago y documentos estan ambos completos - nunca antes, y
 * nunca en dos pasos separados. La verificacion de que ambos campos
 * existan y de que el estado siga siendo DRAFT se hace dos veces: antes
 * de abrir la transaccion (para poder devolver el error especifico sin
 * pagar el costo de un nivel de aislamiento Serializable cuando ya
 * sabemos que va a fallar) y otra vez DENTRO de la transaccion
 * Serializable (para cerrar la ventana de carrera contra otra operacion
 * concurrente sobre la misma reserva, seccion 10.1 del TDD).
 *
 * Hallazgo critico "cambio de estado y auditoria no son atomicos": toda
 * la operacion (relectura, mutacion y auditoria) corre ahora dentro de
 * una unica transaccion Serializable abierta por este handler via
 * TransactionManagerPort - un fallo al escribir el evento de auditoria
 * revierte tambien la confirmacion.
 *
 * Hallazgo critico "IDOR entre sedes/empresas": scope completo en vez de
 * solo organizationId.
 */
@Injectable()
export class ConfirmReservationHandler {
  constructor(
    private readonly reservations: ReservationRepositoryPort,
    private readonly workContext: WorkContextAuthorizationService,
    private readonly auditRepository: AuditEventRepositoryPort,
    private readonly transactionManager: TransactionManagerPort,
  ) {}

  async execute(command: ConfirmReservationCommand): Promise<ReservationRecord> {
    const context = await this.workContext.authorize({
      firebaseUid: command.firebaseUid,
      companyId: command.companyId,
      branchId: command.branchId,
    });

    const scope = {
      organizationId: context.organizationId,
      operatingCompanyId: command.companyId,
      branchId: command.branchId,
    };

    const existing = await this.reservations.findById(command.id, scope);
    if (!existing) {
      throw new NotFoundException('Reserva no encontrada.');
    }
    if (existing.status !== 'DRAFT') {
      throw new ReservationStateConflictError('confirmar', existing.status);
    }
    this.assertRequirementsComplete(existing.paymentValidatedAt, existing.documentsCompletedAt);

    return this.transactionManager.run(
      async (tx) => {
        const current = await this.reservations.findById(command.id, scope, tx);
        if (!current) {
          throw new NotFoundException('Reserva no encontrada.');
        }
        if (current.status !== 'DRAFT') {
          throw new ReservationStateConflictError('confirmar', current.status);
        }
        this.assertRequirementsComplete(current.paymentValidatedAt, current.documentsCompletedAt);

        const confirmed = await this.reservations.confirm(command.id, scope, command.expectedVersion, tx);

        await this.auditRepository.recordReservationEvent(
          {
            organizationId: context.organizationId,
            actorUserId: command.firebaseUid,
            reservationId: confirmed.id,
            action: 'RESERVATION_CONFIRMED',
            changes: { vehicleId: confirmed.vehicleId, startAt: confirmed.startAt, endAt: confirmed.endAt },
          },
          tx,
        );

        return confirmed;
      },
      { isolationLevel: 'Serializable' },
    );
  }

  private assertRequirementsComplete(paymentValidatedAt: Date | null, documentsCompletedAt: Date | null): void {
    const missing: string[] = [];
    if (!paymentValidatedAt) missing.push('pago del monto de reserva vigente');
    if (!documentsCompletedAt) missing.push('documentos/contrato');
    if (missing.length > 0) {
      throw new RequirementsIncompleteError(missing);
    }
  }
}
