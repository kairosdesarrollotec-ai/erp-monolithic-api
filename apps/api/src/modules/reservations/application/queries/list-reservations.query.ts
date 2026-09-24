import { ReservationStatus } from '../../domain/reservation-status';

/**
 * Hallazgo critico de revision PR#6 ("bug de bandeja: companyId enviado
 * como branchId"): el controller anterior construia esta query pasando
 * `query.companyId` dos veces (como companyId Y como branchId), de modo
 * que la bandeja SIEMPRE quedaba vacia (ningun branchId real de la
 * asignacion coincide con un companyId). Se agrega ademas paginacion por
 * cursor (createdAt+id, ver ReservationRepositoryPort.list).
 */
export class ListReservationsQuery {
  constructor(
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly status?: ReservationStatus,
    public readonly limit: number = 20,
    public readonly cursor?: { createdAt: Date; id: string },
  ) {}
}
