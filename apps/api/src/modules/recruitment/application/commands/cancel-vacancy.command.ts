export class CancelVacancyCommand {
  constructor(
    public readonly firebaseUid: string,
    public readonly id: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly expectedVersion: number,
    public readonly reason: string,
  ) {}
}
