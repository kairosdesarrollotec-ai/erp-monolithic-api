/**
 * BR-CON-002 - Consulta -> Alquiler directo. Vehiculo y duracion salen de la
 * cotizacion vigente de la consulta, nunca del payload. El alquiler se crea
 * en DRAFT SIN `startAt`/`expectedEndAt`: se fijan en `complete-delivery`.
 */
export class ConvertToRentalCommand {
  constructor(
    public readonly id: string,
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly expectedVersion: number,
    public readonly planCode?: string,
  ) {}
}
