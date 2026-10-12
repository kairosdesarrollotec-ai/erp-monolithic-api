export class GetEmployeeMemosQuery {
  constructor(
    public readonly firebaseUid: string,
    public readonly employeeId: string,
  ) {}
}
