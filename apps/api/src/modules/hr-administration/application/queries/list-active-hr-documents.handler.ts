import { Injectable } from '@nestjs/common';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { HrDocumentRepositoryPort } from '../ports/hr-document-repository.port';
import { EmployeeRepositoryPort } from '../ports/employee-repository.port';
import { ListActiveHrDocumentsQuery } from './list-active-hr-documents.query';
import { HrDocumentResponse } from '../../presentation/http/dto/hr-administration.response';
import { toHrDocumentResponse } from '../../presentation/http/hr-administration.mapper';

@Injectable()
export class ListActiveHrDocumentsHandler {
  constructor(
    private readonly hrDocuments: HrDocumentRepositoryPort,
    private readonly employees: EmployeeRepositoryPort,
    private readonly workContext: WorkContextAuthorizationService,
    private readonly matrixAuth: MatrixAuthorizationService,
  ) {}

  async execute(query: ListActiveHrDocumentsQuery): Promise<{ items: HrDocumentResponse[]; total: number }> {
    const context = await this.workContext.authorize({
      firebaseUid: query.firebaseUid,
      companyId: query.companyId,
      branchId: query.branchId,
    });

    await this.matrixAuth.assertAllowed(
      context.organizationId,
      context.roleId,
      'HR_ADMINISTRATION',
      'VIEW_HR_DOCUMENTS',
      { companyId: context.companyId, branchId: context.branchId },
    );

    const docs = await this.hrDocuments.listActive(query.companyId, query.category);

    const employee = await this.employees.findByFirebaseUid(query.companyId, query.firebaseUid);
    const readMap = new Map<string, Date>();

    if (employee) {
      const reads = await this.hrDocuments.findReadsByEmployee(employee.id);
      for (const r of reads) {
        readMap.set(r.documentVersionId, r.readAt);
      }
    }

    const items = docs.map((doc) => {
      const readAt = doc.currentVersion ? (readMap.get(doc.currentVersion.id) ?? null) : null;
      return toHrDocumentResponse(doc, { hasRead: readAt !== null, readAt });
    });

    return { items, total: items.length };
  }
}
