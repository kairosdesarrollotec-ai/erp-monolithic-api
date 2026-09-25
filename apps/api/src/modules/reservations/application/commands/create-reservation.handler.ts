import { Injectable } from '@nestjs/common';
import { ReservationRecord } from '../ports/reservation-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { InquiryConversionRequiredError } from '../../domain/reservation-errors';
import { CreateReservationCommand } from './create-reservation.command';

/**
 * RES-P01..P04 - `POST /reservations` (TDD-RES-001.md 11.1).
 *
 * Hallazgo CRITICO de revalidacion PR#7 (d7a6124, "cardinalidad Inquiry ->
 * Reservation no garantizada"): este endpoint creaba una Reserva citando
 * CUALQUIER consulta de la empresa - en cualquier estado, incluso ya
 * cerrada o ya convertida - sin transicionarla. Eso permitia varias
 * reservas por consulta y reservas colgando de consultas
 * CERRADA_SIN_CONVERSION (viola BR-CON-002 "nunca ambos").
 *
 * Decision interina (docs/conflicts/CONFLICT-CON-001.md, pendiente de
 * aprobacion): la unica via para crear una Reserva desde una Consulta es
 * `POST /inquiries/{id}/commands/convert-to-reservation`, que valida la
 * cotizacion vigente y transiciona la Consulta en la misma transaccion.
 * Este endpoint conserva autenticacion, contexto y rol (para no revelar
 * nada a quien no tiene permiso) y luego responde 409
 * INQUIRY_CONVERSION_REQUIRED. Ningun cliente lo usa hoy (erp-portal-web
 * no implementa la creacion de reservas).
 */
@Injectable()
export class CreateReservationHandler {
  constructor(
    private readonly workContext: WorkContextAuthorizationService,
    private readonly matrixAuth: MatrixAuthorizationService,
  ) {}

  async execute(command: CreateReservationCommand): Promise<ReservationRecord> {
    const context = await this.workContext.authorize({
      firebaseUid: command.firebaseUid,
      companyId: command.companyId,
      branchId: command.branchId,
    });
    await this.matrixAuth.assertAllowed(context.organizationId, context.role, 'RESERVATION', 'CREATE');

    throw new InquiryConversionRequiredError(command.inquiryId);
  }
}
