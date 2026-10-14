import { Injectable } from '@nestjs/common';
import { RecruitmentAccessService } from '../services/recruitment-access.service';
import { CandidateDetailRecord, CandidateRepositoryPort } from '../ports/candidate-repository.port';
import { CandidateNotFoundError } from '../../domain/recruitment-errors';
import { maskCandidateSensitiveFields } from '../../domain/recruitment-rules';
import { GetCandidateDetailQuery } from './get-candidate-detail.query';

@Injectable()
export class GetCandidateDetailHandler {
  constructor(
    private readonly access: RecruitmentAccessService,
    private readonly candidates: CandidateRepositoryPort,
  ) {}

  async execute(query: GetCandidateDetailQuery): Promise<CandidateDetailRecord> {
    const { context, scope } = await this.access.authorize(
      {
        firebaseUid: query.firebaseUid,
        companyId: query.companyId,
        branchId: query.branchId,
      },
      'VIEW_CANDIDATE',
    );

    const candidate = await this.candidates.findDetailById(query.id, scope);
    if (!candidate) {
      throw new CandidateNotFoundError(query.id);
    }

    const canViewSensitive = await this.access.isActionAllowed(context, 'VIEW_CANDIDATE_SENSITIVE_DATA');

    return maskCandidateSensitiveFields(candidate, canViewSensitive);
  }
}
