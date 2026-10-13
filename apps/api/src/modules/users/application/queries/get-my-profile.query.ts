export class GetMyProfileQuery {
  constructor(
    public readonly firebaseUid: string,
    public readonly email?: string | null,
    public readonly displayName?: string | null,
  ) {}
}
