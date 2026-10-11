export class AuthorizeFieldTripCommand {
  constructor(
    public readonly firebaseUid: string,
    public readonly fieldTripId: string,
    public readonly authorizationLevel: number,
    public readonly notes?: string | null,
  ) {}
}
