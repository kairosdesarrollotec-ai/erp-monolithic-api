import { Injectable, NotFoundException } from '@nestjs/common';
import { ReservationRepositoryPort, ReservationRecord } from '../ports/reservation-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import {
  RequirementsIncompleteError,
  ReservationExceedsGuaranteeError,
  ReservationRequirementsNotMetError,
  ReservationStateConflictError,
} from '../../domain/reservation-errors';
import { isRemoteReservation } from '../../domain/channel-mode';
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
 *
 * Hallazgo real 23 sep 2026 (revision de erp-api-local contra
 * TDD-KAIROS-TRANSVERSAL.md 7.3, ADR-KAI-003): la confirmacion no
 * publicaba ningun evento a outbox_events pese a que el modelo Prisma ya
 * existia - sin esto no hay ningun evento real para que el agregador
 * transversal de TR-06/TR-07/TR-08 consuma (ver
 * claude/Diseno_Agregador_Transversal_TR-06-07-08.md en el Project). Se
 * publica dentro de la misma transaccion Serializable que la mutacion y
 * la auditoria, mismo criterio de atomicidad ya aplicado a
 * AuditEventRepositoryPort.
 */
@Injectable()
export class ConfirmReservationHandler {
  constructor(
    private readonly reservations: ReservationRepositoryPort,
    private readonly workContext: WorkContextAuthorizationService,
    private readonly auditRepository: AuditEventRepositoryPort,
    private readonly outboxRepository: OutboxEventRepositoryPort,
    private readonly transactionManager: TransactionManagerPort,
    private readonly matrixAuth: MatrixAuthorizationService,
  ) {}

  async execute(command: ConfirmReservationCommand): Promise<ReservationRecord> {
    const context = await this.workContext.authorize({
      firebaseUid: command.firebaseUid,
      companyId: command.companyId,
      branchId: command.branchId,
    });

    await this.matrixAuth.assertAllowed(context.organizationId, context.roleId, 'RESERVATION', 'CONFIRM', { companyId: context.companyId, branchId: context.branchId });

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
    this.assertRemoteRequirements(existing);
    await this.assertWithinVehicleGuarantee(existing);

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
        this.assertRemoteRequirements(current);

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

        await this.outboxRepository.publish(
          {
            aggregateType: 'Reservation',
            aggregateId: confirmed.id,
            eventType: 'ReservationConfirmed',
            payload: {
              organizationId: confirmed.organizationId,
              operatingCompanyId: confirmed.operatingCompanyId,
              branchId: confirmed.branchId,
              customerId: confirmed.customerId,
              vehicleId: confirmed.vehicleId,
              startAt: confirmed.startAt,
              endAt: confirmed.endAt,
              confirmedBy: command.firebaseUid,
            },
          },
          tx,
        );

        return confirmed;
      },
      { isolationLevel: 'Serializable' },
    );
  }

  /**
   * Validacion defensiva (Fiorella, 16-oct-2026: "la reserva nunca superara la garantia"):
   * la creacion real vive en Consultas (convert-to-reservation), asi que se vuelve a comprobar
   * al confirmar contra `Vehicle.depositMinimum` (Flota). Sin garantia definida no se valida.
   */
  private async assertWithinVehicleGuarantee(reservation: ReservationRecord): Promise<void> {
    const vehicle = await this.reservations.findVehicleById(reservation.vehicleId);
    if (vehicle?.depositMinimum == null) return;
    const amountCents = Math.round(Number(reservation.requiredPaymentAmount) * 100);
    const guaranteeCents = Math.round(Number(vehicle.depositMinimum) * 100);
    if (amountCents > guaranteeCents) {
      throw new ReservationExceedsGuaranteeError(reservation.requiredPaymentAmount, (guaranteeCents / 100).toFixed(2));
    }
  }

  private assertRequirementsComplete(paymentValidatedAt: Date | null, documentsCompletedAt: Date | null): void {
    const missing: string[] = [];
    if (!paymentValidatedAt) missing.push('pago del monto de reserva vigente');
    if (!documentsCompletedAt) missing.push('documentos/contrato');
    if (missing.length > 0) {
      throw new RequirementsIncompleteError(missing);
    }
  }

  /**
   * BR-RES-005 / BR-RES-006 / SC-RES-003 / SC-RES-004:
   * En modalidad remota exige video 360° del vehículo y documento de aceptación firmado.
   * Si falta alguno, se rechaza con 422 RESERVATION_REQUIREMENTS_NOT_MET y el vehículo
   * permanece disponible para otros clientes.
   */
  private assertRemoteRequirements(reservation: ReservationRecord): void {
    if (!isRemoteReservation(reservation)) return;

    const missingRemote: string[] = [];
    if (!reservation.video360Uploaded) {
      missingRemote.push('video 360 del vehículo');
    }
    if (!reservation.signedAcceptanceUploaded) {
      missingRemote.push('documento de aceptación firmado');
    }

    if (missingRemote.length > 0) {
      throw new ReservationRequirementsNotMetError(missingRemote);
    }
  }
}

