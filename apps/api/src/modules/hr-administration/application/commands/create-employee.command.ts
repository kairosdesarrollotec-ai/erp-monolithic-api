export class CreateEmployeeCommand {
  constructor(
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly documentType: string,
    public readonly documentNumber: string,
    public readonly fullName: string,
    public readonly areaId: string,
    public readonly areaName: string,
    public readonly jobTitle: string,
    public readonly hireDate: Date,
    public readonly email?: string | null,
    public readonly phone?: string | null,
    public readonly baseSalary?: number | null,
    public readonly candidateId?: string | null,
    /** H-02: codigo del catalogo de areas de la empresa. Si viene, manda sobre `areaId`/`areaName` (que pueden ir vacios). */
    public readonly areaCode?: string | null,
  ) {}
}
