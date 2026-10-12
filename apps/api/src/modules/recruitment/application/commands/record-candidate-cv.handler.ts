import { Injectable } from '@nestjs/common';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { ClockPort } from '../../../../common/application/ports/clock.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { RecruitmentAccessService } from '../services/recruitment-access.service';
import { CandidateDetailRecord, CandidateRepositoryPort } from '../ports/candidate-repository.port';
import { CandidateCvStoragePort } from '../ports/candidate-cv-storage.port';
import { CandidateCvNotUploadedError, CandidateNotFoundError } from '../../domain/recruitment-errors';
import {
  assertCandidateCvFile,
  assertCandidateCvObjectOwned,
  maskCandidateSensitiveFields,
  sanitizeCvFileName,
} from '../../domain/recruitment-rules';
import { RecordCandidateCvCommand } from './record-candidate-cv.command';

/**
 * REC-03/REC-04: registra el CV ya subido. Verifica contra el almacenamiento (existencia, tipo y tamano reales)
 * en lugar de confiar en lo que declara el cliente; If-Match sobre la version del candidato; auditoria.
 */
@Injectable()
export class RecordCandidateCvHandler {
  constructor(
    private readonly access: RecruitmentAccessService,
    private readonly candidates: CandidateRepositoryPort,
    private readonly storage: CandidateCvStoragePort,
    private readonly transactionManager: TransactionManagerPort,
    private readonly clock: ClockPort,
    private readonly auditRepository: AuditEventRepositoryPort,
  ) {}

  async execute(command: RecordCandidateCvCommand): Promise<CandidateDetailRecord> {
    const { context, scope } = await this.access.authorize(
      { firebaseUid: command.firebaseUid, companyId: command.companyId, branchId: command.branchId },
      'REGISTER_CANDIDATE',
    );

    const candidate = await this.candidates.findScopedById(command.candidateId, scope);
    if (!candidate) {
      throw new CandidateNotFoundError(command.candidateId);
    }

    assertCandidateCvObjectOwned(
      this.storage.isOwnedObjectUrl(command.objectUrl, {
        companyId: scope.operatingCompanyId,
        candidateId: candidate.id,
      }),
    );

    const metadata = await this.storage.getObjectMetadata(command.objectUrl);
    if (!metadata) {
      throw new CandidateCvNotUploadedError();
    }
    const contentType = metadata.contentType ?? '';
    assertCandidateCvFile(contentType, metadata.sizeBytes);

    return this.transactionManager.run(async (tx) => {
      const now = this.clock.now();
      const updated = await this.candidates.setCv(
        candidate.id,
        {
          objectUrl: command.objectUrl,
          fileName: sanitizeCvFileName(command.fileName),
          contentType,
          sizeBytes: metadata.sizeBytes,
          uploadedAt: now,
          uploadedBy: command.firebaseUid,
        },
        command.expectedVersion,
        tx,
      );

      await this.auditRepository.recordRecruitmentEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.firebaseUid,
          entityType: 'candidate',
          entityId: updated.id,
          action: 'CANDIDATE_CV_UPLOADED',
          changes: {
            fileName: updated.cv?.fileName ?? null,
            contentType,
            sizeBytes: metadata.sizeBytes,
            replacedPreviousCv: candidate.hasCv,
            version: updated.version,
          },
        },
        tx,
      );

      const detail = await this.candidates.findDetailById(candidate.id, tx);
      if (!detail) {
        throw new CandidateNotFoundError(candidate.id);
      }
      const canViewSensitive = await this.access.isActionAllowed(context, 'VIEW_CANDIDATE_SENSITIVE_DATA');
      return maskCandidateSensitiveFields(detail, canViewSensitive);
    });
  }
}
