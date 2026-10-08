import { VacancySource } from '@prisma/client';

export class RegisterVacancyCommand {
  constructor(
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly title: string,
    public readonly department: string,
    public readonly source: VacancySource,
    public readonly isMechanic: boolean = false,
  ) {}
}
