import { Injectable } from '@nestjs/common';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import { HrAdministrationAccessService } from '../services/hr-administration-access.service';
import { EmployeeRepositoryPort } from '../ports/employee-repository.port';
import { ExpectationDocumentRepositoryPort } from '../ports/expectation-document-repository.port';
import { EmployeeNotFoundError } from '../../domain/hr-administration-errors';
import { computeExpectationDeadlineDate } from '../../domain/expectation-document';
import { assertHttpUrl } from '../../../../common/domain/http-url';
import { RecordExpectationDocumentCommand } from './record-expectation-document.command';
import type { ExpectationDocumentResponse } from '../../presentation/http/dto/hr-administration.response';

/**
 * REC-P13 / BDD-05 / BDD-00 - Registra el documento de expectativas firmado del colaborador.
 * Permiso MANAGE_EXPECTATION_DOCUMENT (RRHH y Gerencia por defecto).
 */
@Injectable()
export class RecordExpectationDocumentHandler {
  constructor(
    private readonly access: HrAdministrationAccessService,
    private readonly employees: EmployeeRepositoryPort,
    private readonly expectationRepo: ExpectationDocumentRepositoryPort,
    private readonly transactionManager: TransactionManagerPort,
    private readonly auditRepository: AuditEventRepositoryPort,
    private readonly outboxRepository: OutboxEventRepositoryPort,
  ) {}

  async execute(command: RecordExpectationDocumentCommand): Promise<ExpectationDocumentResponse> {
    // R-6: solo enlaces http/https (antes se guardaba "hola" o "javascript:...").
    const fileUrl = assertHttpUrl(command.fileUrl);

    const found = await this.employees.findById(command.employeeId);
    if (!found) {
      throw new EmployeeNotFoundError(command.employeeId);
    }

    const { context } = await this.access.authorize(
      {
        firebaseUid: command.firebaseUid,
        companyId: found.operatingCompanyId,
        branchId: found.branchId,
      },
      'MANAGE_EXPECTATION_DOCUMENT',
    );

    const deadlineDate = computeExpectationDeadlineDate(found.hireDate);
    const signedAt = command.signedAt ?? new Date();

    return this.transactionManager.run(async (tx) => {
      const saved = await this.expectationRepo.upsert(
        {
          organizationId: context.organizationId,
          operatingCompanyId: context.companyId,
          employeeId: found.id,
          status: 'FIRMADO',
          deadlineDate,
          fileUrl,
          signedAt,
          registeredBy: found.candidateId ? 'RECLUTAMIENTO' : command.firebaseUid,
          signedRegisteredBy: command.firebaseUid,
          notes: command.notes ?? null,
        },
        tx,
      );

      await this.auditRepository.recordHrAdministrationEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.firebaseUid,
          entityType: 'hr_document',
          entityId: saved.id,
          action: 'EMPLOYEE_EXPECTATION_DOCUMENT_RECORDED',
          changes: {
            employeeId: found.id,
            status: 'FIRMADO',
            fileUrl,
            signedAt: signedAt.toISOString(),
            signedRegisteredBy: command.firebaseUid,
            notes: command.notes ?? null,
          },
        },
        tx,
      );

      await this.outboxRepository.publish(
        {
          aggregateType: 'employee',
          aggregateId: found.id,
          eventType: 'DocumentoExpectativasRegistrado.v1',
          payload: {
            employeeId: found.id,
            employeeName: found.fullName,
            organizationId: context.organizationId,
            operatingCompanyId: context.companyId,
            branchId: context.branchId,
            fileUrl,
            signedAt: signedAt.toISOString(),
            signedRegisteredBy: command.firebaseUid,
          },
        },
        tx,
      );

      return {
        id: saved.id,
        employeeId: saved.employeeId,
        companyId: saved.operatingCompanyId,
        status: 'FIRMADO',
        deadlineDate: saved.deadlineDate.toISOString().slice(0, 10),
        isOverdue: false,
        fileUrl: saved.fileUrl,
        signedAt: saved.signedAt ? saved.signedAt.toISOString() : null,
        registeredBy: saved.registeredBy,
        signedRegisteredBy: saved.signedRegisteredBy,
        notes: saved.notes,
        createdAt: saved.createdAt.toISOString(),
        updatedAt: saved.updatedAt.toISOString(),
      };
    });
  }
}
