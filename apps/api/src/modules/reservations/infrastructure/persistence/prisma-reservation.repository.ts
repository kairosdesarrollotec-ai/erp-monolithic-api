import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import {
  ReservationRepositoryPort,
  ReservationRecord,
  ReservationScope,
  CreateReservationInput,
  ListReservationsFilter,
  CancelReservationInput,
} from '../../application/ports/reservation-repository.port';
import {
  InquiryAlreadyHasReservationError,
  ReservationVersionConflictError,
  VehicleNotAvailableError,
} from '../../domain/reservation-errors';
import { TERMINAL_RESERVATION_STATUSES } from '../../domain/reservation-status';

/**
 * Hallazgo MEDIO de revision PR#6 ("as unknown as ocultan la
 * verificacion real del cliente Prisma"), mismo motivo y mismo fix que
 * ya se aplico en PrismaWorkContextRepository (PR#5, 12fc688): se
 * confirmo que `npx prisma generate` funciona en la Terminal real del
 * usuario y que el CI lo corre en cada build/test, asi que el cliente
 * tipado real esta disponible - se eliminan los `as unknown as` de este
 * archivo y se usan los tipos que Prisma genera con
 * `Prisma.ReservationGetPayload`, que SI falla en build si el
 * select/include deja de coincidir con el shape usado abajo.
 */
type ReservationWithRelations = Prisma.ReservationGetPayload<{
  include: { customer: true; vehicle: true };
}>;

function toRecord(row: ReservationWithRelations): ReservationRecord {
  return {
    id: row.id,
    organizationId: row.organizationId,
    operatingCompanyId: row.operatingCompanyId,
    branchId: row.branchId,
    inquiryId: row.inquiryId,
    customerId: row.customerId,
    customerName: row.customer.fullName,
    vehicleId: row.vehicleId,
    vehiclePlate: row.vehicle.plate,
    vehicleLabel: `${row.vehicle.brand} ${row.vehicle.model} - ${row.vehicle.plate}`,
    status: row.status,
    channelMode: row.channelMode,
    startAt: row.startAt,
    endAt: row.endAt,
    requiredPaymentAmount: row.requiredPaymentAmount.toString(),
    currency: row.currency,
    paymentPolicyVersion: row.paymentPolicyVersion,
    paymentValidatedAt: row.paymentValidatedAt,
    documentsCompletedAt: row.documentsCompletedAt,
    confirmedAt: row.confirmedAt,
    createdAt: row.createdAt,
    createdBy: row.createdBy,
    version: row.version,
  };
}

/** Hallazgo critico PR#6 ("IDOR"): where de scope completo, reusado en cada lectura/mutacion puntual. */
function scopeWhere(id: string, scope: ReservationScope) {
  return {
    id,
    organizationId: scope.organizationId,
    operatingCompanyId: scope.operatingCompanyId,
    branchId: scope.branchId,
  };
}

@Injectable()
export class PrismaReservationRepository implements ReservationRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    input: CreateReservationInput,
    tx?: Prisma.TransactionClient,
  ): Promise<ReservationRecord> {
    const client = tx ?? this.prisma;
    let created: ReservationWithRelations;
    try {
      created = await client.reservation.create({
        data: {
          organizationId: input.organizationId,
          operatingCompanyId: input.operatingCompanyId,
          branchId: input.branchId,
          inquiryId: input.inquiryId,
          customerId: input.customerId,
          vehicleId: input.vehicleId,
          channelMode: input.channelMode,
          startAt: input.startAt,
          endAt: input.endAt,
          requiredPaymentAmount: input.requiredPaymentAmount,
          currency: input.currency,
          paymentPolicyVersion: input.paymentPolicyVersion,
          createdBy: input.createdBy,
        },
        include: { customer: true, vehicle: true },
      });
    } catch (error) {
      // UNIQUE reservations.inquiry_id (revalidacion PR#7): una consulta
      // se convierte a lo sumo una vez - la base gana cualquier carrera.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        /inquiry_?id/i.test(JSON.stringify(error.meta?.target ?? ''))
      ) {
        throw new InquiryAlreadyHasReservationError();
      }
      throw error;
    }
    return toRecord(created);
  }

  async findById(
    id: string,
    scope: ReservationScope,
    tx?: Prisma.TransactionClient,
  ): Promise<ReservationRecord | null> {
    const client = tx ?? this.prisma;
    const row: ReservationWithRelations | null = await client.reservation.findFirst({
      where: scopeWhere(id, scope),
      include: { customer: true, vehicle: true },
    });
    return row ? toRecord(row) : null;
  }

  async list(filter: ListReservationsFilter): Promise<ReservationRecord[]> {
    const rows: ReservationWithRelations[] = await this.prisma.reservation.findMany({
      where: {
        organizationId: filter.organizationId,
        operatingCompanyId: filter.operatingCompanyId,
        branchId: filter.branchId,
        status: filter.status,
      },
      include: { customer: true, vehicle: true },
      // Hallazgo medio "listado sin paginacion": cursor estable
      // (createdAt DESC, id DESC como desempate) + limite maximo, en vez
      // de traer la tabla completa.
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: filter.limit,
      ...(filter.cursor
        ? {
            cursor: { id: filter.cursor.id },
            skip: 1,
          }
        : {}),
    });
    return rows.map(toRecord);
  }

  async registerPayment(
    id: string,
    scope: ReservationScope,
    expectedVersion: number,
    tx?: Prisma.TransactionClient,
  ): Promise<ReservationRecord> {
    return this.bumpVersion(id, scope, expectedVersion, { paymentValidatedAt: new Date() }, tx);
  }

  async registerDocuments(
    id: string,
    scope: ReservationScope,
    expectedVersion: number,
    tx?: Prisma.TransactionClient,
  ): Promise<ReservationRecord> {
    return this.bumpVersion(id, scope, expectedVersion, { documentsCompletedAt: new Date() }, tx);
  }

  private async bumpVersion(
    id: string,
    scope: ReservationScope,
    expectedVersion: number,
    data: Prisma.ReservationUpdateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<ReservationRecord> {
    const client = tx ?? this.prisma;
    const result = await client.reservation.updateMany({
      where: { ...scopeWhere(id, scope), version: expectedVersion },
      data: { ...data, version: { increment: 1 } },
    });
    if (result.count === 0) {
      throw new ReservationVersionConflictError();
    }
    const updated: ReservationWithRelations = await client.reservation.findFirstOrThrow({
      where: scopeWhere(id, scope),
      include: { customer: true, vehicle: true },
    });
    return toRecord(updated);
  }

  /**
   * TDD-RES-001.md seccion 10.1 - transaccion atomica unica: re-verifica
   * ambos requisitos dentro de la propia transaccion (no confia solo en
   * la lectura previa del handler, por seguridad frente a condiciones de
   * carrera), y solicita el vehicle_commitment consolidado en el mismo
   * paso.
   *
   * Hallazgo critico PR#6 ("cambio de estado y auditoria no son
   * atomicos"): `tx` ahora es OBLIGATORIO (lo abre el handler via
   * TransactionManagerPort.run con isolationLevel Serializable) en vez
   * de que este metodo abra su propia transaccion - asi la escritura de
   * auditoria del handler puede ejecutarse dentro del mismo `tx`,
   * despues de este metodo, sin una segunda transaccion separada.
   */
  async confirm(
    id: string,
    scope: ReservationScope,
    expectedVersion: number,
    tx: Prisma.TransactionClient,
  ): Promise<ReservationRecord> {
    const reservation = await tx.reservation.findFirst({ where: scopeWhere(id, scope) });
    if (!reservation || reservation.version !== expectedVersion) {
      throw new ReservationVersionConflictError();
    }
    if (!reservation.paymentValidatedAt || !reservation.documentsCompletedAt) {
      // El handler ya valida esto antes de llegar aqui; esta es la
      // re-verificacion de seguridad dentro de la transaccion.
      throw new ReservationVersionConflictError();
    }

    const overlapping = await tx.vehicleCommitment.findFirst({
      where: {
        vehicleId: reservation.vehicleId,
        status: { in: ['ACTIVE', 'CONSOLIDATED'] },
        startsAt: { lt: reservation.endAt },
        endsAt: { gt: reservation.startAt },
      },
    });
    if (overlapping) {
      throw new VehicleNotAvailableError();
    }

    await tx.vehicleCommitment.create({
      data: {
        organizationId: scope.organizationId,
        vehicleId: reservation.vehicleId,
        sourceType: 'RESERVATION',
        sourceId: reservation.id,
        status: 'CONSOLIDATED',
        startsAt: reservation.startAt,
        endsAt: reservation.endAt,
      },
    });

    // Hallazgo CRITICO de revision de seguimiento de PR#6 (d442508,
    // "cancelacion vulnerable a carrera TOCTOU"): el mismo patron
    // (leer version, mutar sin volver a filtrar por version) tambien
    // afectaba a este metodo - se reemplaza el `update({ where: { id } })`
    // ciego por un `updateMany` cuyo `where` exige la MISMA version que
    // se acaba de verificar. Si otra transaccion concurrente ya
    // modifico la fila entre la lectura de arriba y este punto (aunque
    // aqui corra dentro de un tx Serializable, ver comentario de
    // ConfirmReservationHandler), `count` da 0 y se lanza el conflicto
    // de version en vez de sobreescribir en silencio.
    const result = await tx.reservation.updateMany({
      where: { ...scopeWhere(id, scope), version: expectedVersion },
      data: { status: 'CONFIRMED', confirmedAt: new Date(), version: { increment: 1 } },
    });
    if (result.count !== 1) {
      throw new ReservationVersionConflictError();
    }

    const updated: ReservationWithRelations = await tx.reservation.findFirstOrThrow({
      where: scopeWhere(id, scope),
      include: { customer: true, vehicle: true },
    });
    return toRecord(updated);
  }

  /**
   * Hallazgo critico PR#6 (original): `tx` obligatorio, mismo motivo que
   * `confirm` (ver comentario arriba).
   *
   * Hallazgo CRITICO de revision de seguimiento de PR#6 (d442508,
   * "cancelacion vulnerable a carrera TOCTOU / perdida de concurrencia
   * optimista"): la version anterior leia la fila con `findFirst`,
   * comparaba `version` a mano, y despues ejecutaba
   * `reservation.update({ where: { id } })` SIN version ni scope en el
   * where - dos solicitudes concurrentes con el mismo `If-Match` podian
   * pasar ambas la lectura (todavia no habia commit de ninguna) y
   * ambas ejecutar el update, duplicando el efecto (doble liberacion de
   * commitment, version incrementada dos veces por dos requests que
   * creian estar actuando sobre la misma version). Se reemplaza por un
   * `updateMany` atomico cuyo `where` exige scope + version esperada +
   * que el estado NO sea ya terminal - la base de datos decide en una
   * sola sentencia si la fila sigue siendo la que el cliente cree que
   * es, sin depender del nivel de aislamiento de la transaccion.
   */
  async cancel(input: CancelReservationInput, tx: Prisma.TransactionClient): Promise<ReservationRecord> {
    const reservation = await tx.reservation.findFirst({ where: scopeWhere(input.id, input) });
    if (!reservation) {
      throw new ReservationVersionConflictError();
    }

    if (reservation.status === 'CONFIRMED') {
      await tx.vehicleCommitment.updateMany({
        where: { sourceType: 'RESERVATION', sourceId: reservation.id, status: { in: ['ACTIVE', 'CONSOLIDATED'] } },
        data: { status: 'RELEASED' },
      });
    }

    const result = await tx.reservation.updateMany({
      where: {
        ...scopeWhere(input.id, input),
        version: input.expectedVersion,
        status: { notIn: Array.from(TERMINAL_RESERVATION_STATUSES) },
      },
      data: { status: 'CANCELLED', version: { increment: 1 } },
    });
    if (result.count !== 1) {
      throw new ReservationVersionConflictError();
    }

    const updated: ReservationWithRelations = await tx.reservation.findFirstOrThrow({
      where: scopeWhere(input.id, input),
      include: { customer: true, vehicle: true },
    });
    return toRecord(updated);
  }
}
