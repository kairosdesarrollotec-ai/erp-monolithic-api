import { Injectable, NotFoundException } from '@nestjs/common';
import { ReservationRepositoryPort, ReservationRecord } from '../ports/reservation-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { ReservationStateConflictError } from '../../domain/reservation-errors';
import { RegisterPaymentCommand } from './register-payment.command';

/**
 * RES-P09 (BR-RES-001) - solo marca payment_validated_at. Nunca crea un
 * vehicle_commitment por si solo (BR-RES-009, DR-RES-002 - el bloqueo es
 * atomico y ocurre unicamente en ConfirmReservationHandler).
 *
 * Hallazgo critico "IDOR entre sedes/empresas": la busqueda de la
 * reserva ahora exige el ReservationScope completo (organizationId +
 * operatingCompanyId + branchId) devuelto por
 * WorkContextAuthorizationService, no solo organizationId.
 *
 * Hallazgo alto "maquina de estados incompleta": solo se puede registrar
 * pago mientras la reserva sigue en DRAFT.
 */
@Injectable()
export class RegisterPaymentHandler {
  constructor(
    private readonly reservations: ReservationRepositoryPort,
    private readonly workContext: WorkContextAuthorizationService,
    private readonly matrixAuth: MatrixAuthorizationService,
  ) {}

  async execute(command: RegisterPaymentCommand): Promise<ReservationRecord> {
    const context = await this.workContext.authorize({
      firebaseUid: command.firebaseUid,
      companyId: command.companyId,
      branchId: command.branchId,
    });

    await this.matrixAuth.assertAllowed(context.organizationId, context.role, 'RESERVATION', 'REGISTER_PAYMENT');

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
      throw new ReservationStateConflictError('registrar el pago de', existing.status);
    }

    return this.reservations.registerPayment(command.id, scope, command.expectedVersion);
  }
}
