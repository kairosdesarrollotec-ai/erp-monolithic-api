export class LinkEmployeeAccountCommand {
  constructor(
    public readonly firebaseUid: string,
    public readonly employeeId: string,
  ) {}
}
