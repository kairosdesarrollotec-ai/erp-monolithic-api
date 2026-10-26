export class GetExpectationDocumentQuery {
  constructor(
    public readonly employeeId: string,
    public readonly firebaseUid: string,
  ) {}
}
