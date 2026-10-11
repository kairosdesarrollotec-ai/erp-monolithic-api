export class GetEmployeeDetailQuery {
  constructor(
    public readonly firebaseUid: string,
    public readonly employeeId: string,
  ) {}
}
