import { Injectable } from '@nestjs/common';
import { RecruitmentAccessService } from '../services/recruitment-access.service';
import { VacancyRecord, VacancyRepositoryPort } from '../ports/vacancy-repository.port';
import { ListVacanciesQuery } from './list-vacancies.query';

@Injectable()
export class ListVacanciesHandler {
  constructor(
    private readonly access: RecruitmentAccessService,
    private readonly vacancies: VacancyRepositoryPort,
  ) {}

  async execute(query: ListVacanciesQuery): Promise<VacancyRecord[]> {
    const { scope } = await this.access.authorize(
      {
        firebaseUid: query.firebaseUid,
        companyId: query.companyId,
        branchId: query.branchId,
      },
      'VIEW_VACANCY',
    );

    return this.vacancies.list(
      {
        operatingCompanyId: scope.operatingCompanyId,
        branchId: query.branchId,
        status: query.status,
        limit: query.limit,
        cursorCreatedAt: query.cursorCreatedAt,
        cursorId: query.cursorId,
      },
      {
        organizationId: scope.organizationId,
        operatingCompanyId: scope.operatingCompanyId,
      },
    );
  }
}
