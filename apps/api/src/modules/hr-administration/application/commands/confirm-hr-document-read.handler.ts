import { Injectable } from '@nestjs/common';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { HrDocumentRepositoryPort } from '../ports/hr-document-repository.port';
import { EmployeeRepositoryPort } from '../ports/employee-repository.port';
import { ConfirmHrDocumentReadCommand } from './confirm-hr-document-read.command';
import { ConfirmHrDocumentReadResponse } from '../../presentation/http/dto/hr-administration.response';
import {
  HrDocumentEmployeeNotFoundError,
  HrDocumentNotFoundError,
} from '../../domain/hr-document-errors';

@Injectable()
export class ConfirmHrDocumentReadHandler {
  constructor(
    private readonly hrDocuments: HrDocumentRepositoryPort,
    private readonly employees: EmployeeRepositoryPort,
    private readonly workContext: WorkContextAuthorizationService,
    private readonly matrixAuth: MatrixAuthorizationService,
    private readonly auditRepository: AuditEventRepositoryPort,
  ) {}

  async execute(command: ConfirmHrDocumentReadCommand): Promise<ConfirmHrDocumentReadResponse> {
    const context = await this.workContext.authorize({
      firebaseUid: command.firebaseUid,
      companyId: command.companyId,
      branchId: command.branchId,
    });

    await this.matrixAuth.assertAllowed(
      context.organizationId,
      context.roleId,
      'HR_ADMINISTRATION',
      'CONFIRM_HR_DOCUMENT_READ',
      { companyId: context.companyId, branchId: context.branchId },
    );

    const employee = await this.employees.findByFirebaseUid(context.companyId, command.firebaseUid);
    if (!employee) {
      throw new HrDocumentEmployeeNotFoundError();
    }

    const doc = await this.hrDocuments.findActiveById(command.documentId, context.companyId);
    if (!doc || !doc.currentVersion) {
      throw new HrDocumentNotFoundError();
    }

    const record = await this.hrDocuments.recordRead({
      documentVersionId: doc.currentVersion.id,
      employeeId: employee.id,
      companyId: context.companyId,
      organizationId: context.organizationId,
      readByUid: command.firebaseUid,
    });

    await this.auditRepository.recordHrAdministrationEvent({
      organizationId: context.organizationId,
      actorUserId: command.firebaseUid,
      entityType: 'hr_document_read',
      entityId: record.id,
      action: 'HR_DOCUMENT_READ_CONFIRMED',
      changes: {
        documentId: doc.id,
        documentVersionId: doc.currentVersion.id,
        code: doc.code,
        version: doc.currentVersion.version,
        employeeId: employee.id,
        readAt: record.readAt.toISOString(),
      },
    });

    return {
      documentId: doc.id,
      employeeId: employee.id,
      readAt: record.readAt.toISOString(),
    };
  }
}
