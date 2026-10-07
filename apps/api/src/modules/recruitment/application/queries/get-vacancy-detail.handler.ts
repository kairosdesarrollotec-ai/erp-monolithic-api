import { Injectable } from '@nestjs/common';
import { RecruitmentAccessService } from '../services/recruitment-access.service';
import { VacancyDetailRecord, VacancyRepositoryPort } from '../ports/vacancy-repository.port';
import { VacancyNotFoundError } from '../../domain/recruitment-errors';
import { GetVacancyDetailQuery } from './get-vacancy-detail.query';

@Injectable()
export class GetVacancyDetailHandler {
  constructor(
    private readonly access: RecruitmentAccessService,
    private readonly vacancies: VacancyRepositoryPort,
  ) {}

  async execute(query: GetVacancyDetailQuery): Promise<VacancyDetailRecord> {
    const { scope } = await this.access.authorize(
      {
        firebaseUid: query.firebaseUid,
        companyId: query.companyId,
        branchId: query.branchId,
      },
      'VIEW_VACANCY',
    );

    const vacancy = await this.vacancies.findDetailById(query.id, scope);
    if (!vacancy) {
      throw new VacancyNotFoundError(query.id);
    }

    return vacancy;
  }
}
