export class RecordCompanyExpenseCommand {
  constructor(
    public readonly firebaseUid: string,
    public readonly rentalId: string,
    public readonly companyId: string,
    public readonly expenseType: 'GASTO_NOTARIAL',
    public readonly amount: number,
    public readonly expenseDate: string,
    public readonly reference: string,
    public readonly currency: string = 'PEN',
    public readonly notes?: string,
    public readonly paidByCustomer: boolean = false,
  ) {}
}
