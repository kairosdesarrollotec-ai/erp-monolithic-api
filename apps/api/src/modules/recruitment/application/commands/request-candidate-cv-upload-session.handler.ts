import { Injectable } from '@nestjs/common';
import { RecruitmentAccessService } from '../services/recruitment-access.service';
import { CandidateRepositoryPort } from '../ports/candidate-repository.port';
import { CandidateCvStoragePort, CandidateCvUploadSession } from '../ports/candidate-cv-storage.port';
import { CandidateNotFoundError } from '../../domain/recruitment-errors';
import { assertCandidateCvFile, CANDIDATE_CV_MAX_BYTES } from '../../domain/recruitment-rules';
import { RequestCandidateCvUploadSessionCommand } from './request-candidate-cv-upload-session.command';

/** REC-03/REC-04: pide una URL firmada de subida del CV. Valida tipo y tamano ANTES de firmar. */
@Injectable()
export class RequestCandidateCvUploadSessionHandler {
  constructor(
    private readonly access: RecruitmentAccessService,
    private readonly candidates: CandidateRepositoryPort,
    private readonly storage: CandidateCvStoragePort,
  ) {}

  async execute(command: RequestCandidateCvUploadSessionCommand): Promise<CandidateCvUploadSession> {
    const { scope } = await this.access.authorize(
      { firebaseUid: command.firebaseUid, companyId: command.companyId, branchId: command.branchId },
      'REGISTER_CANDIDATE',
    );

    assertCandidateCvFile(command.contentType, command.contentLength);

    const candidate = await this.candidates.findScopedById(command.candidateId, scope);
    if (!candidate) {
      throw new CandidateNotFoundError(command.candidateId);
    }

    return this.storage.generateSignedUploadUrl({
      companyId: scope.operatingCompanyId,
      candidateId: candidate.id,
      contentType: command.contentType,
      maxBytes: CANDIDATE_CV_MAX_BYTES,
    });
  }
}
