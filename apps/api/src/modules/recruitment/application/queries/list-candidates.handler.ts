import { Injectable } from '@nestjs/common';
import { RecruitmentAccessService } from '../services/recruitment-access.service';
import { VacancyRepositoryPort } from '../ports/vacancy-repository.port';
import { CandidateRecord, CandidateRepositoryPort } from '../ports/candidate-repository.port';
import { VacancyNotFoundError } from '../../domain/recruitment-errors';
import { ListCandidatesQuery } from './list-candidates.query';

/** REC-03 - candidatos de una vacante para el tablero Kanban (la respuesta HTTP omite datos sensibles). */
@Injectable()
export class ListCandidatesHandler {
  constructor(
    private readonly access: RecruitmentAccessService,
    private readonly vacancies: VacancyRepositoryPort,
    private readonly candidates: CandidateRepositoryPort,
  ) {}

  async execute(query: ListCandidatesQuery): Promise<CandidateRecord[]> {
    const { scope } = await this.access.authorize(
      { firebaseUid: query.firebaseUid, companyId: query.companyId, branchId: query.branchId },
      'VIEW_CANDIDATE',
    );

    const vacancy = await this.vacancies.findById(query.vacancyId, scope);
    if (!vacancy) {
      throw new VacancyNotFoundError(query.vacancyId);
    }

    const all = await this.candidates.listByVacancy(vacancy.id);
    return query.stage ? all.filter((c) => c.stage === query.stage) : all;
  }
}
