export class SetCompanyDriverDailyRateCommand {
  constructor(
    public readonly id: string,
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly expectedVersion: number,
    /** Tarifa diaria en PEN: monto > 0 con maximo 2 decimales. */
    public readonly dailyRate: string,
  ) {}
}
