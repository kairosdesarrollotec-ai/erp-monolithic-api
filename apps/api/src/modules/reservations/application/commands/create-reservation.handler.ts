import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ReservationRepositoryPort, ReservationRecord } from '../ports/reservation-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { CURRENT_RESERVATION_DEPOSIT_POLICY } from '../../domain/reservation-deposit-policy';
import { CreateReservationCommand } from './create-reservation.command';

/**
 * RES-P01-P04 del BDD - crea la reserva en DRAFT. El vehiculo/cliente/
 * consulta de origen ya se resolvieron antes de este punto (heredados de
 * Consulta, PANTALLAS-V3-B-RESERVA.md RES-04 punto 15) - este comando no
 * los vuelve a pedir, solo los persiste. El company_id/branch_id que
 * llega del cliente siempre se valida contra las asignaciones reales del
 * usuario antes de aceptarlo (SDD-KAIROS-TRANSVERSAL.md 14.3), ahora via
 * el servicio central WorkContextAuthorizationService (mismo patron que
 * TR-06 desde la correccion de PR#5) en vez de llamar directo al
 * repositorio.
 *
 * Hallazgo critico de revision PR#6 ("referencias cross-tenant al
 * crear"): customerId/vehicleId/inquiryId tambien llegan del cliente sin
 * cruzarse contra nada - antes se persistian tal cual, permitiendo crear
 * una reserva que apunta a un cliente/vehiculo/consulta de OTRA
 * organizacion. Se resuelven aqui las 3 entidades bajo el
 * organizationId ya autorizado (nunca el que mande el payload) y se
 * rechaza la operacion si alguna no existe o pertenece a otra
 * organizacion.
 */
@Injectable()
export class CreateReservationHandler {
  constructor(
    private readonly reservations: ReservationRepositoryPort,
    private readonly workContext: WorkContextAuthorizationService,
  ) {}

  async execute(command: CreateReservationCommand): Promise<ReservationRecord> {
    if (command.startAt >= command.endAt) {
      throw new BadRequestException({
        code: 'INVALID_PERIOD',
        detail: 'La fecha de inicio debe ser anterior a la fecha de fin.',
      });
    }

    const context = await this.workContext.authorize({
      firebaseUid: command.firebaseUid,
      companyId: command.companyId,
      branchId: command.branchId,
    });

    const [customer, vehicle, inquiry] = await Promise.all([
      this.reservations.findCustomerById(command.customerId),
      this.reservations.findVehicleById(command.vehicleId),
      this.reservations.findInquiryById(command.inquiryId),
    ]);

    if (!customer || customer.organizationId !== context.organizationId) {
      throw new NotFoundException({
        code: 'CUSTOMER_NOT_FOUND',
        detail: 'El cliente indicado no existe en esta organizacion.',
      });
    }
    if (!vehicle || vehicle.organizationId !== context.organizationId) {
      throw new NotFoundException({
        code: 'VEHICLE_NOT_FOUND',
        detail: 'El vehiculo indicado no existe en esta organizacion.',
      });
    }
    if (!inquiry || inquiry.organizationId !== context.organizationId) {
      throw new NotFoundException({
        code: 'INQUIRY_NOT_FOUND',
        detail: 'La consulta de origen no existe en esta organizacion.',
      });
    }

    return this.reservations.create({
      organizationId: context.organizationId,
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
