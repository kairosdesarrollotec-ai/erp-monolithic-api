import { VacancyStatus } from '@prisma/client';

export class ListVacanciesQuery {
  constructor(
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly status?: VacancyStatus,
    public readonly limit?: number,
    public readonly cursorCreatedAt?: Date,
    public readonly cursorId?: string,
  ) {}
}
