import { Injectable } from '@nestjs/common';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import { HrDocumentRepositoryPort, HrDocumentWithCurrentVersion } from '../ports/hr-document-repository.port';
import { PublishHrDocumentCommand } from './publish-hr-document.command';
import {
  InvalidHrDocumentCategoryError,
  InvalidHrDocumentCodeError,
} from '../../domain/hr-document-errors';

const VALID_CATEGORIES = new Set(['REGULATION', 'POLICY', 'FORMAT']);

@Injectable()
export class PublishHrDocumentHandler {
  constructor(
    private readonly hrDocuments: HrDocumentRepositoryPort,
    private readonly workContext: WorkContextAuthorizationService,
    private readonly matrixAuth: MatrixAuthorizationService,
    private readonly auditRepository: AuditEventRepositoryPort,
    private readonly outboxRepository: OutboxEventRepositoryPort,
    private readonly transactionManager: TransactionManagerPort,
  ) {}

  async execute(command: PublishHrDocumentCommand): Promise<HrDocumentWithCurrentVersion> {
    const context = await this.workContext.authorize({
      firebaseUid: command.firebaseUid,
      companyId: command.companyId,
      branchId: command.branchId,
    });

    await this.matrixAuth.assertAllowed(
      context.organizationId,
      context.roleId,
      'HR_ADMINISTRATION',
      'MANAGE_HR_DOCUMENTS',
      { companyId: context.companyId, branchId: context.branchId },
    );

    const category = command.category.trim().toUpperCase();
    if (!VALID_CATEGORIES.has(category)) {
      throw new InvalidHrDocumentCategoryError(command.category);
    }

    const code = command.code.trim().toUpperCase();
    if (!code) {
      throw new InvalidHrDocumentCodeError();
    }

    return this.transactionManager.run(async (tx) => {
      const published = await this.hrDocuments.publishVersion(
        {
          organizationId: context.organizationId,
          operatingCompanyId: command.companyId,
          code,
          title: command.title.trim(),
          category,
          fileUrl: command.fileUrl.trim(),
          fileHash: command.fileHash ?? null,
          fileName: command.fileName ?? null,
          mimeType: command.mimeType ?? 'application/pdf',
          sizeBytes: command.sizeBytes ?? null,
          publishedBy: command.firebaseUid,
        },
        tx,
      );

      await this.auditRepository.recordHrAdministrationEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.firebaseUid,
          entityType: 'hr_document',
          entityId: published.id,
          action: 'HR_DOCUMENT_PUBLISHED',
          changes: {
            code: published.code,
            title: published.title,
            category: published.category,
            version: published.currentVersion.version,
            versionId: published.currentVersion.id,
          },
        },
        tx,
      );

      await this.outboxRepository.publish(
        {
          aggregateType: 'HrDocument',
          aggregateId: published.id,
          eventType: 'HrDocumentPublished.v1',
          payload: {
            organizationId: context.organizationId,
            operatingCompanyId: command.companyId,
            documentId: published.id,
            versionId: published.currentVersion.id,
            code: published.code,
            title: published.title,
            category: published.category,
            version: published.currentVersion.version,
            publishedBy: command.firebaseUid,
          },
        },
        tx,
      );

      return published;
    });
  }
}
