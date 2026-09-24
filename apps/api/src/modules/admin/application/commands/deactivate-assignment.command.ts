export class DeactivateAssignmentCommand {
  constructor(
    public readonly actorFirebaseUid: string,
    public readonly actorCompanyId: string,
    public readonly actorBranchId: string,
    public readonly assignmentId: string,
  ) {}
}
