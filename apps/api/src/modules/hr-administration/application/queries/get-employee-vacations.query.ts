export class GetEmployeeVacationsQuery {
  constructor(
    public readonly firebaseUid: string,
    public readonly employeeId: string,
  ) {}
}
