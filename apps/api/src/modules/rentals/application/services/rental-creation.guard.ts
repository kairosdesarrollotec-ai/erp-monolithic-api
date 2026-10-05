import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { ClockPort } from '../../../../common/application/ports/clock.port';
import { RentalRepositoryPort } from '../ports/rental-repository.port';
import { CustomerBlockedError, VehicleNotAvailableForRentalError } from '../../domain/rental-errors';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface RentalVehicleCandidate {
  id: string;
  organizationId: string;
  branchId: string | null;
  status: string;
}

export interface RentalAvailabilityWindowInput {
  /** Por defecto, ahora. */
  startAt?: Date;
  expectedEndAt?: Date;
  /** Duracion de la cotizacion; se usa si no hay `expectedEndAt`. */
  estimatedDays?: number;
}

/**
 * Reglas de endurecimiento compartidas por todo camino que crea (o entrega)
 * un Alquiler directo: `POST /rentals`, `convert-to-rental` y
 * `complete-delivery`.
 *
 * - Cliente ROJO -> CUSTOMER_BLOCKED (BDD-ALQ-001 21.1 DT-ALQ-05; BR-DEV-008).
 *   El AMBAR ("cliente observado") sigue siendo cliente activo (Ficha AS-IS
 *   Alquiler, seccion 7; BDD-KAIROS-TRANSVERSAL 10.10) y NO bloquea. El
 *   modelo solo persiste NORMAL | ROJO.
 * - Vehiculo: estado AVAILABLE, de la misma sede (o compartido entre sedes,
 *   `branchId` null) y sin compromiso ACTIVE/CONSOLIDATED que se solape con
 *   el periodo (NFR-KAI-001, VEHICLE_NOT_AVAILABLE). Si no hay fecha de
 *   fin ni duracion, solo se verifica el instante de inicio.
 */
@Injectable()
export class RentalCreationGuard {
  constructor(
    private readonly rentals: RentalRepositoryPort,
    private readonly clock: ClockPort,
  ) {}

  assertCustomerNotBlocked(customer: { status: string }): void {
    if (customer.status === 'ROJO') {
      throw new CustomerBlockedError();
    }
  }

  resolveWindow(input: RentalAvailabilityWindowInput): { startsAt: Date; endsAt: Date } {
    const startsAt = input.startAt ?? this.clock.now();
    let endsAt: Date;
    if (input.expectedEndAt) {
      endsAt = input.expectedEndAt;
    } else if (input.estimatedDays && input.estimatedDays > 0) {
      endsAt = new Date(startsAt.getTime() + input.estimatedDays * MS_PER_DAY);
    } else {
      endsAt = new Date(startsAt.getTime() + 1);
    }
    return { startsAt, endsAt };
  }

  async assertVehicleAvailable(
    vehicle: RentalVehicleCandidate,
    branchId: string,
    window: { startsAt: Date; endsAt: Date },
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    if (vehicle.status !== 'AVAILABLE') {
      throw new VehicleNotAvailableForRentalError(
        'STATUS',
        `El vehiculo no esta disponible para alquilar (estado ${vehicle.status}).`,
      );
    }
    if (vehicle.branchId !== null && vehicle.branchId !== branchId) {
      throw new VehicleNotAvailableForRentalError('BRANCH', 'El vehiculo no esta asignado a la sede del alquiler.');
    }
    const overlaps = await this.rentals.hasBlockingVehicleCommitment(
      vehicle.id,
      vehicle.organizationId,
      window.startsAt,
      window.endsAt,
      tx,
    );
    if (overlaps) {
      throw new VehicleNotAvailableForRentalError(
        'COMMITMENT_OVERLAP',
        'El vehiculo tiene una reserva o compromiso que se solapa con el periodo del alquiler.',
      );
    }
  }
}
