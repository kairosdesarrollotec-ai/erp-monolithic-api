import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ReservationRecord } from '../ports/reservation-repository.port';
import { ReservationRepositoryPort } from '../ports/reservation-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { ReservationExceedsGuaranteeError } from '../../domain/reservation-errors';
import { CreateReservationCommand } from './create-reservation.command';

/**
 * RES-P01..P04 - `POST /reservations` (TDD-RES-001.md 11.1).
 *
 * CONFLICT-CON-001 (resuelto): este endpoint crea una Reserva directamente
 * (sin consulta previa). La via desde una Consulta COTIZADA sigue siendo
 * `POST /inquiries/{id}/commands/convert-to-reservation`.
 *
 * Validaciones:
 * - Rol RESERVATION.CREATE via matriz.
 * - Cliente pertenece a la empresa del contexto.
 * - Vehículo pertenece a la empresa del contexto y está disponible en el intervalo.
 * - El monto de la reserva no supera la garantia del vehiculo (si Flota la tiene definida):
 *   422 RESERVATION_EXCEEDS_GUARANTEE ("la reserva nunca superara la garantia", 16-oct-2026).
 * - Si inquiryId presente, pertenece a la empresa del contexto.
 */
@Injectable()
export class CreateReservationHandler {
  constructor(
    private readonly reservations: ReservationRepositoryPort,
    private readonly workContext: WorkContextAuthorizationService,
    private readonly matrixAuth: MatrixAuthorizationService,
  ) {}

  async execute(command: CreateReservationCommand): Promise<ReservationRecord> {
    const context = await this.workContext.authorize({
      firebaseUid: command.firebaseUid,
      companyId: command.companyId,
      branchId: command.branchId,
    });
    await this.matrixAuth.assertAllowed(context.organizationId, context.roleId, 'RESERVATION', 'CREATE', { companyId: context.companyId, branchId: context.branchId });

    const customer = await this.reservations.findCustomerById(command.customerId);
    if (
      !customer ||
      customer.organizationId !== context.organizationId ||
      customer.operatingCompanyId !== context.companyId
    ) {
      throw new NotFoundException({
        code: 'CUSTOMER_NOT_FOUND',
        detail: 'El cliente indicado no existe en esta empresa.',
      });
    }

    const vehicle = await this.reservations.findVehicleById(command.vehicleId);
    if (!vehicle || vehicle.operatingCompanyId !== context.companyId) {
      throw new NotFoundException({
        code: 'VEHICLE_NOT_FOUND',
        detail: 'El vehículo indicado no existe en esta empresa.',
      });
    }

    if (vehicle.depositMinimum != null) {
      const amountCents = Math.round(Number(command.requiredPaymentAmount) * 100);
      const guaranteeCents = Math.round(Number(vehicle.depositMinimum) * 100);
      if (amountCents > guaranteeCents) {
        throw new ReservationExceedsGuaranteeError(command.requiredPaymentAmount, (guaranteeCents / 100).toFixed(2));
      }
    }

    const available = await this.reservations.isVehicleAvailable(command.vehicleId, command.startAt, command.endAt);
    if (!available) {
      throw new UnprocessableEntityException({
        code: 'VEHICLE_NOT_AVAILABLE',
        detail: 'El vehículo ya no está disponible para el intervalo solicitado.',
      });
    }

    return this.reservations.create({
      organizationId: context.organizationId,
      operatingCompanyId: context.companyId,
      branchId: context.branchId,
      inquiryId: command.inquiryId,
      customerId: command.customerId,
      vehicleId: command.vehicleId,
      channelMode: command.channelMode,
      startAt: command.startAt,
      endAt: command.endAt,
      requiredPaymentAmount: command.requiredPaymentAmount,
      currency: command.currency,
      paymentPolicyVersion: command.paymentPolicyVersion,
      createdBy: command.firebaseUid,
    });
  }
}
