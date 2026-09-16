import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { ReservationRepositoryPort, ReservationRecord } from '../ports/reservation-repository.port';
import { WorkContextRepositoryPort } from '../../../users/application/ports/work-context-repository.port';
import { CURRENT_RESERVATION_DEPOSIT_POLICY } from '../../domain/reservation-deposit-policy';
import { CreateReservationCommand } from './create-reservation.command';

/**
 * RES-P01-P04 del BDD - crea la reserva en DRAFT. El vehiculo/cliente/
 * consulta de origen ya se resolvieron antes de este punto (heredados de
 * Consulta, PANTALLAS-V3-B-RESERVA.md RES-04 punto 15) - este comando no
 * los vuelve a pedir, solo los persiste. El company_id/branch_id que
 * llega del cliente siempre se valida contra las asignaciones reales del
 * usuario antes de aceptarlo (SDD-KAIROS-TRANSVERSAL.md 14.3, mismo
 * patron que SelectWorkContextHandler/GetDashboardHandler).
 */
@Injectable()
export class CreateReservationHandler {
  constructor(
    private readonly reservations: ReservationRepositoryPort,
    private readonly workContext: WorkContextRepositoryPort,
  ) {}

  async execute(command: CreateReservationCommand): Promise<ReservationRecord> {
    if (command.startAt >= command.endAt) {
      throw new BadRequestException({
        code: 'INVALID_PERIOD',
        detail: 'La fecha de inicio debe ser anterior a la fecha de fin.',
      });
    }

    const assignment = await this.workContext.findValidAssignment({
      firebaseUid: command.firebaseUid,
      companyId: command.companyId,
      branchId: command.branchId,
    });
    if (!assignment) {
      throw new ForbiddenException(
        'La combinacion de empresa/sede no es una asignacion vigente para este usuario.',
      );
    }

    return this.reservations.create({
      organizationId: assignment.organizationId,
      operatingCompanyId: command.companyId,
      branchId: command.branchId,
      inquiryId: command.inquiryId,
      customerId: command.customerId,
      vehicleId: command.vehicleId,
      channelMode: command.channelMode,
      startAt: command.startAt,
      endAt: command.endAt,
      requiredPaymentAmount: CURRENT_RESERVATION_DEPOSIT_POLICY.amount,
      currency: CURRENT_RESERVATION_DEPOSIT_POLICY.currency,
      paymentPolicyVersion: CURRENT_RESERVATION_DEPOSIT_POLICY.version,
      createdBy: command.firebaseUid,
    });
  }
}
