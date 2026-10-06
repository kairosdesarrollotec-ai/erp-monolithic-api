export class GetResponsibilityTemplateQuery {
  constructor(
    public readonly returnId: string,
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
  ) {}
}
