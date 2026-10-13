import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { ReservationSaleResolutionRepositoryPort } from '../ports/reservation-sale-resolution-repository.port';
import type { ReservationRecord } from '../ports/reservation-repository.port';
import { AlternativeVehicleInvalidError } from '../../domain/reservation-sale-resolution';
import { VehicleNotAvailableError } from '../../domain/reservation-errors';

/**
 * Valida que un vehiculo pueda ser la alternativa de una reserva cuyo
 * vehiculo se vendio: misma organizacion/empresa (la FK compuesta de
 * `reservations` lo exige igual), distinto del vendido, sede compatible
 * (o compartido entre sedes), estado AVAILABLE y libre en la ventana de la
 * reserva segun la regla unica de solape (VEHICLE_NOT_AVAILABLE, 409).
 * No hay reprogramacion (BR-RES-003): la ventana de la reserva no cambia.
 */
@Injectable()
export class SaleAlternativeVehicleGuard {
  constructor(private readonly saleResolutions: ReservationSaleResolutionRepositoryPort) {}

  async assertUsable(reservation: ReservationRecord, vehicleId: string, tx?: Prisma.TransactionClient): Promise<void> {
    if (vehicleId === reservation.vehicleId) {
      throw new AlternativeVehicleInvalidError('El vehiculo alternativo debe ser distinto del vehiculo vendido.');
    }
    const vehicle = await this.saleResolutions.findVehicleById(vehicleId, tx);
    if (
      !vehicle ||
      vehicle.organizationId !== reservation.organizationId ||
      vehicle.operatingCompanyId !== reservation.operatingCompanyId
    ) {
      throw new AlternativeVehicleInvalidError('El vehiculo alternativo no existe en la empresa de la reserva.');
    }
    if (vehicle.branchId !== null && vehicle.branchId !== reservation.branchId) {
      throw new AlternativeVehicleInvalidError('El vehiculo alternativo no esta asignado a la sede de la reserva.');
    }
    if (vehicle.status !== 'AVAILABLE') {
      throw new AlternativeVehicleInvalidError(`El vehiculo alternativo no esta disponible (estado ${vehicle.status}).`);
    }
    const conflict = await this.saleResolutions.findVehicleConflict(
      vehicle.id,
      reservation.startAt,
      reservation.endAt,
      reservation.id,
      tx,
    );
    if (conflict) {
      throw new VehicleNotAvailableError(conflict);
    }
  }
}
