export class GetEmployeeLeavesQuery {
  constructor(
    public readonly firebaseUid: string,
    public readonly employeeId: string,
  ) {}
}
