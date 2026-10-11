import { Injectable } from '@nestjs/common';
import type { Employee } from '@prisma/client';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { HrAdministrationAccessService } from '../services/hr-administration-access.service';
import { EmployeeRepositoryPort } from '../ports/employee-repository.port';
import { CandidateAlreadyEmployeeError, DuplicateEmployeeDocumentError } from '../../domain/hr-administration-errors';
import { CreateEmployeeCommand } from './create-employee.command';

function isUniqueViolation(error: unknown): { target: string } | null {
  const e = error as { code?: string; meta?: { target?: unknown } } | null;
  if (e?.code !== 'P2002') return null;
  return { target: JSON.stringify(e.meta?.target ?? '') };
}

/**
 * ADP-01: alta del colaborador. La identidad Empleado es propia: NUNCA se fusiona con Cliente ni con Candidato
 * (`candidateId` solo es un vínculo de origen, un candidato incorporado da lugar a un único colaborador).
 */
@Injectable()
export class CreateEmployeeHandler {
  constructor(
    private readonly access: HrAdministrationAccessService,
    private readonly employees: EmployeeRepositoryPort,
    private readonly transactionManager: TransactionManagerPort,
    private readonly auditRepository: AuditEventRepositoryPort,
  ) {}

  async execute(command: CreateEmployeeCommand): Promise<Employee> {
    const { context, scope } = await this.access.authorize(
      {
        firebaseUid: command.firebaseUid,
        companyId: command.companyId,
        branchId: command.branchId,
      },
      'MANAGE_EMPLOYEES',
    );

    const documentNumber = command.documentNumber.trim();

    try {
      return await this.transactionManager.run(async (tx) => {
        const existing = await this.employees.findByCompanyAndDocument(scope.operatingCompanyId, documentNumber, tx);
        if (existing) {
          throw new DuplicateEmployeeDocumentError(documentNumber);
        }

        const created = await this.employees.create(
          {
            organizationId: scope.organizationId,
            operatingCompanyId: scope.operatingCompanyId,
            branchId: scope.branchId,
            candidateId: command.candidateId ?? null,
            documentType: command.documentType,
            documentNumber,
            fullName: command.fullName.trim(),
            email: command.email?.trim() || null,
            phone: command.phone?.trim() || null,
            areaId: command.areaId.trim(),
            areaName: command.areaName.trim(),
            jobTitle: command.jobTitle.trim(),
            hireDate: command.hireDate,
            baseSalary: command.baseSalary ?? null,
          },
          tx,
        );

        await this.auditRepository.recordHrAdministrationEvent(
          {
            organizationId: context.organizationId,
            actorUserId: command.firebaseUid,
            entityType: 'employee',
            entityId: created.id,
            action: 'EMPLOYEE_CREATED',
            changes: {
              fullName: created.fullName,
              areaId: created.areaId,
              jobTitle: created.jobTitle,
              status: created.status,
              candidateId: created.candidateId,
            },
          },
          tx,
        );

        return created;
      });
    } catch (error) {
      const violation = isUniqueViolation(error);
      if (violation) {
        if (violation.target.includes('candidate')) {
          throw new CandidateAlreadyEmployeeError();
        }
        throw new DuplicateEmployeeDocumentError(documentNumber);
      }
      throw error;
    }
  }
}
