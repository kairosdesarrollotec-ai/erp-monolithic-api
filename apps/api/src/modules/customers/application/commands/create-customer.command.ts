export class CreateCustomerCommand {
  constructor(
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly fullName: string,
    public readonly documentType: string,
    public readonly documentNumber: string,
    public readonly nationality?: 'PERUANO' | 'EXTRANJERO',
    public readonly countryEntryDate?: Date,
    public readonly email?: string,
    public readonly phone?: string,
    public readonly address?: string,
  ) {}
}
