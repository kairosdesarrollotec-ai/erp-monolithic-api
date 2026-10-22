import { Injectable } from '@nestjs/common';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { InquiryConversionRequiredError, InquiryRequiredError } from '../../domain/reservation-errors';
import { CreateReservationCommand } from './create-reservation.command';

/**
 * RES-P01..P04 - `POST /reservations`.
 *
 * Russbel 22-oct-2026 (decision 1; BR-CON-003, EX-CON-001, DEC-CON-001-FINAL): la Consulta es el unico punto de
 * entrada. Una Reserva solo nace de `POST /inquiries/{id}/commands/convert-to-reservation`, que transiciona la Consulta
 * a CONVERTIDA en la misma transaccion, lee el monto/politica de ADM-03, valida el tope de garantia (F-01) y la
 * disponibilidad del vehiculo. Por eso este handler ya no crea nada:
 *
 * - sin `inquiryId`  -> 422 INQUIRY_REQUIRED;
 * - con `inquiryId`  -> 409 INQUIRY_CONVERSION_REQUIRED (permanente).
 *
 * Se mantiene la autorizacion previa (contexto de trabajo + RESERVATION.CREATE) para que un usuario sin permiso reciba
 * 403 en vez de aprender el contrato de error.
 */
@Injectable()
export class CreateReservationHandler {
  constructor(
    private readonly workContext: WorkContextAuthorizationService,
    private readonly matrixAuth: MatrixAuthorizationService,
  ) {}

  async execute(command: CreateReservationCommand): Promise<never> {
    const context = await this.workContext.authorize({
      firebaseUid: command.firebaseUid,
      companyId: command.companyId,
      branchId: command.branchId,
    });
    await this.matrixAuth.assertAllowed(context.organizationId, context.roleId, 'RESERVATION', 'CREATE', { companyId: context.companyId, branchId: context.branchId });

    if (!command.inquiryId) {
      throw new InquiryRequiredError();
    }
    throw new InquiryConversionRequiredError(command.inquiryId);
  }
}
