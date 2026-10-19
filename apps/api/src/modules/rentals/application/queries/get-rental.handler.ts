import { Injectable, NotFoundException } from '@nestjs/common';
import { RentalRepositoryPort, RentalRecord } from '../ports/rental-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { resolveReservationCredit } from '../../domain/reservation-credit';
import { computeCompanyDriverCharge } from '../../domain/company-driver-charge';
import { isCompanyDriverVariantCode } from '../../domain/contract-variant';
import { GetRentalQuery } from './get-rental.query';

@Injectable()
export class GetRentalHandler {
  constructor(
    private readonly rentals: RentalRepositoryPort,
    private readonly workContext: WorkContextAuthorizationService,
    private readonly matrixAuth: MatrixAuthorizationService,
  ) {}

  async execute(query: GetRentalQuery): Promise<RentalRecord> {
    const context = await this.workContext.authorize({
      firebaseUid: query.firebaseUid,
      companyId: query.companyId,
      branchId: query.branchId,
    });

    await this.matrixAuth.assertAllowed(context.organizationId, context.roleId, 'RENTAL', 'READ', { companyId: context.companyId, branchId: context.branchId });

    const rental = await this.rentals.findById(query.id, {
      organizationId: context.organizationId,
      operatingCompanyId: query.companyId,
      branchId: query.branchId,
    });

    if (!rental) {
      throw new NotFoundException('Alquiler no encontrado.');
    }

    const extensions = await this.rentals.listExtensionsByRentalId(rental.id);

    // P0-03 (a): vista previa del traslado reserva -> garantia para ENTREGA-03.
    // Solo alquileres de origen Reserva; en alquiler directo queda en null.
    // Respuesta de Fiorella 16-oct-2026: conductor de la empresa = tarifa diaria x dias (vista, no persistida).
    const companyDriverCharge = isCompanyDriverVariantCode(rental.contract?.contractVariant)
      ? computeCompanyDriverCharge({
          dailyRate: process.env.COMPANY_DRIVER_DAILY_RATE,
          currency: process.env.COMPANY_DRIVER_DAILY_RATE_CURRENCY,
          startAt: rental.startAt,
          expectedEndAt: rental.expectedEndAt,
        })
      : null;
    if (!rental.reservationId) {
      return { ...rental, reservationCredit: null, extensions, companyDriverCharge };
    }
    const source = await this.rentals.findReservationCreditSource(rental.reservationId);
    return { ...rental, reservationCredit: resolveReservationCredit(source), extensions, companyDriverCharge };
  }
}
