export class GetFieldTripQuery {
  constructor(
    public readonly firebaseUid: string,
    public readonly fieldTripId: string,
  ) {}
}
