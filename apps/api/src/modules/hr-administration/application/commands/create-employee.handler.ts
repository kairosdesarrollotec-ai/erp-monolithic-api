import { Injectable } from '@nestjs/common';
import type { Employee } from '@prisma/client';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { HrAdministrationAccessService } from '../services/hr-administration-access.service';
import { EmployeeRepositoryPort } from '../ports/employee-repository.port';
import {
  CandidateAlreadyEmployeeError,
  DuplicateEmployeeDocumentError,
  EmployeeSalaryGerenciaOnlyError,
  HrAreaRequiredError,
} from '../../domain/hr-administration-errors';
import { HrAreaResolverService } from '../services/hr-area-resolver.service';
import { EmployeeAccountLinkService } from '../services/employee-account-link.service';
import { normalizeEmail } from '../../domain/hr-administration-rules';
import { assertValidIdentityDocument, assertValidPhone } from '../../../../common/domain/identity-document';
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
    private readonly accountLinker?: EmployeeAccountLinkService,
    private readonly areaResolver?: HrAreaResolverService,
  ) {}

  async execute(command: CreateEmployeeCommand): Promise<Employee> {
    assertValidIdentityDocument(command.documentType, command.documentNumber);
    assertValidPhone(command.phone);

    const { context, scope } = await this.access.authorize(
      {
        firebaseUid: command.firebaseUid,
        companyId: command.companyId,
        branchId: command.branchId,
      },
      'MANAGE_EMPLOYEES',
    );

    // Respuestas 2026-10-20 #19 (P2 del 21-oct): igual que en la edicion, el sueldo base solo lo fija Gerencia
    // (MANAGE_SALARY). Quien no lo tiene puede crear la ficha SIN sueldo (omitido o null = «pendiente», baseSalary queda
    // NULL y Gerencia lo completa despues con PATCH); si envia un valor -> 403 EMPLOYEE_SALARY_GERENCIA_ONLY, sin crear nada.
    const requestedSalary = command.baseSalary ?? null;
    if (requestedSalary !== null && !(await this.access.isActionAllowed(context, 'MANAGE_SALARY'))) {
      throw new EmployeeSalaryGerenciaOnlyError();
    }

    const documentNumber = command.documentNumber.trim();

    // H-02: el area sale del catalogo (areaCode) o del texto libre normalizado; BR-ADP-002 compara `areaId` por igualdad.
    const area = this.areaResolver
      ? await this.areaResolver.resolve({
          operatingCompanyId: scope.operatingCompanyId,
          areaCode: command.areaCode,
          areaId: command.areaId,
          areaName: command.areaName,
        })
      : { areaId: command.areaId.trim(), areaName: command.areaName.trim() };
    const areaId = area.areaId;
    const areaName = area.areaName;
    if (!areaId || !areaName) {
      throw new HrAreaRequiredError();
    }

    try {
      const created = await this.transactionManager.run(async (tx) => {
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
            email: normalizeEmail(command.email),
            phone: command.phone?.trim() || null,
            areaId,
            areaName,
            jobTitle: command.jobTitle.trim(),
            hireDate: command.hireDate,
            baseSalary: requestedSalary,
            bankName: command.bankName ?? null,
            bankAccountNumber: command.bankAccountNumber ?? null,
            bankAccountCci: command.bankAccountCci ?? null,
            contractType: command.contractType ?? null,
            contractUrl: command.contractUrl ?? null,
            contractNotes: command.contractNotes ?? null,
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
      // DEC-ADP-LINK-EMAIL-001: si ya existe una cuenta con ese correo, la ficha queda vinculada (best-effort).
      return this.accountLinker ? await this.accountLinker.tryLink(created) : created;
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
