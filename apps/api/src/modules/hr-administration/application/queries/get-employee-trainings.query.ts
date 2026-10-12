export class GetEmployeeTrainingsQuery {
  constructor(
    public readonly firebaseUid: string,
    public readonly employeeId: string,
  ) {}
}
