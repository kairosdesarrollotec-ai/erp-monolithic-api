export class GetVacationsCalendarQuery {
  constructor(
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly year: number,
    public readonly month?: number,
    public readonly areaId?: string,
  ) {}
}
