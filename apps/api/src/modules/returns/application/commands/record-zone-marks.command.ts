export interface ZoneMarkInput {
  zone: string;
  mark: string;
}

export class RecordZoneMarksCommand {
  constructor(
    public readonly id: string,
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly marks: readonly ZoneMarkInput[],
  ) {}
}
