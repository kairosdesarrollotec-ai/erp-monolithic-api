export class ListActiveHrDocumentsQuery {
  constructor(
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly category?: string,
  ) {}
}
