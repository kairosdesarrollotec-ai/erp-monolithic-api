export class PublishVacancyCommand {
  constructor(
    public readonly firebaseUid: string,
    public readonly id: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly profileDescription: string,
    public readonly baseSalary: number,
    public readonly scheduleDetails: string,
    public readonly channels: string[],
    public readonly expectedVersion: number,
  ) {}
}
