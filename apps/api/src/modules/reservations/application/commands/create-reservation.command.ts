/**
 * Russbel 22-oct-2026 (decision 1): `POST /reservations` ya no crea reservas (Consulta es el unico punto de entrada).
 * El comando solo transporta lo necesario para autorizar y para responder el error correcto.
 */
export class CreateReservationCommand {
  constructor(
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly inquiryId?: string,
  ) {}
}
