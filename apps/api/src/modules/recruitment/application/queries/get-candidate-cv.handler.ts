import { Injectable } from '@nestjs/common';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { RecruitmentAccessService } from '../services/recruitment-access.service';
import { CandidateRepositoryPort } from '../ports/candidate-repository.port';
import { CandidateCvStoragePort } from '../ports/candidate-cv-storage.port';
import { CandidateCvNotFoundError, CandidateNotFoundError } from '../../domain/recruitment-errors';
import { GetCandidateCvQuery } from './get-candidate-cv.query';

export interface CandidateCvViewRecord {
  url: string;
  expiresAt: Date;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  uploadedAt: Date;
}

/**
 * REC-04 visor de CV: URL firmada de lectura de vida corta. Exige el permiso de datos sensibles
 * (el CV es DAT-REC-004, sensible) y deja rastro de cada consulta.
 */
@Injectable()
export class GetCandidateCvHandler {
  constructor(
    private readonly access: RecruitmentAccessService,
    private readonly candidates: CandidateRepositoryPort,
    private readonly storage: CandidateCvStoragePort,
    private readonly auditRepository: AuditEventRepositoryPort,
  ) {}

  async execute(query: GetCandidateCvQuery): Promise<CandidateCvViewRecord> {
    const { context, scope } = await this.access.authorize(
      { firebaseUid: query.firebaseUid, companyId: query.companyId, branchId: query.branchId },
      'VIEW_CANDIDATE_SENSITIVE_DATA',
    );

    const candidate = await this.candidates.findScopedById(query.candidateId, scope);
    if (!candidate) {
      throw new CandidateNotFoundError(query.candidateId);
    }
    if (!candidate.cv) {
      throw new CandidateCvNotFoundError();
    }

    const signed = await this.storage.generateSignedReadUrl(candidate.cv.objectUrl, {
      fileName: candidate.cv.fileName,
      contentType: candidate.cv.contentType,
    });

    await this.auditRepository.recordRecruitmentEvent({
      organizationId: context.organizationId,
      actorUserId: query.firebaseUid,
      entityType: 'candidate',
      entityId: candidate.id,
      action: 'CANDIDATE_CV_VIEWED',
      changes: { fileName: candidate.cv.fileName },
    });

    return {
      url: signed.url,
      expiresAt: signed.expiresAt,
      fileName: candidate.cv.fileName,
      contentType: candidate.cv.contentType,
      sizeBytes: candidate.cv.sizeBytes,
      uploadedAt: candidate.cv.uploadedAt,
    };
  }
}
