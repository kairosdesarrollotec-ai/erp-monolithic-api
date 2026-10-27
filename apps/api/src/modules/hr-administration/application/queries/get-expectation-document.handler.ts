import { Injectable } from '@nestjs/common';
import { HrAdministrationAccessService } from '../services/hr-administration-access.service';
import { EmployeeRepositoryPort } from '../ports/employee-repository.port';
import { ExpectationDocumentRepositoryPort } from '../ports/expectation-document-repository.port';
import { EmployeeNotFoundError } from '../../domain/hr-administration-errors';
import { computeExpectationDeadlineDate, isExpectationOverdue } from '../../domain/expectation-document';
import { GetExpectationDocumentQuery } from './get-expectation-document.query';
import type { ExpectationDocumentResponse } from '../../presentation/http/dto/hr-administration.response';

/**
 * REC-P13 / BDD-05 / BDD-00 - Consulta el documento de expectativas del colaborador.
 * Permiso VIEW_EMPLOYEES (o acceso autorizado al colaborador).
 */
@Injectable()
export class GetExpectationDocumentHandler {
  constructor(
    private readonly access: HrAdministrationAccessService,
    private readonly employees: EmployeeRepositoryPort,
    private readonly expectationRepo: ExpectationDocumentRepositoryPort,
  ) {}

  async execute(query: GetExpectationDocumentQuery): Promise<ExpectationDocumentResponse> {
    const found = await this.employees.findById(query.employeeId);
    if (!found) {
      throw new EmployeeNotFoundError(query.employeeId);
    }

    await this.access.authorize(
      {
        firebaseUid: query.firebaseUid,
        companyId: found.operatingCompanyId,
        branchId: found.branchId,
      },
      'VIEW_EMPLOYEES',
    );

    const doc = await this.expectationRepo.findByEmployeeId(found.id);
    const deadlineDate = computeExpectationDeadlineDate(found.hireDate);
    const now = new Date();

    if (!doc) {
      const isOverdue = isExpectationOverdue('PENDIENTE', deadlineDate, now);
      return {
        id: `pending-${found.id}`,
        employeeId: found.id,
        companyId: found.operatingCompanyId,
        status: 'PENDIENTE',
        deadlineDate: deadlineDate.toISOString().slice(0, 10),
        isOverdue,
        fileUrl: null,
        signedAt: null,
        registeredBy: found.candidateId ? 'RECLUTAMIENTO' : 'SISTEMA',
        signedRegisteredBy: null,
        notes: null,
        createdAt: found.createdAt.toISOString(),
        updatedAt: found.updatedAt.toISOString(),
      };
    }

    const isOverdue = isExpectationOverdue(doc.status, doc.deadlineDate, now);
    return {
      id: doc.id,
      employeeId: doc.employeeId,
      companyId: doc.operatingCompanyId,
      status: doc.status as 'PENDIENTE' | 'FIRMADO',
      deadlineDate: doc.deadlineDate.toISOString().slice(0, 10),
      isOverdue,
      fileUrl: doc.fileUrl,
      signedAt: doc.signedAt ? doc.signedAt.toISOString() : null,
      registeredBy: doc.registeredBy,
      signedRegisteredBy: doc.signedRegisteredBy,
      notes: doc.notes,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
    };
  }
}
