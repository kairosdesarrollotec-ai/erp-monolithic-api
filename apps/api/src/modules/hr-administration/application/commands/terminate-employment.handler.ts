import { Injectable } from '@nestjs/common';
import type { Employee, EmploymentTermination } from '@prisma/client';
import { ClockPort } from '../../../../common/application/ports/clock.port';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import { HrAdministrationAccessService } from '../services/hr-administration-access.service';
import { EmployeeRepositoryPort } from '../ports/employee-repository.port';
import { EmploymentTerminationRepositoryPort } from '../ports/employment-termination-repository.port';
import { EmployeeNotFoundError, EmploymentAlreadyTerminatedError } from '../../domain/hr-administration-errors';
import { assertTerminationRules } from '../../domain/hr-administration-rules';
import { TerminateEmploymentCommand } from './terminate-employment.command';

export interface TerminateEmploymentResult {
  termination: EmploymentTermination;
  employee: Employee;
}

/**
 * ADP-P15..17 / BR-ADP-006 / BR-REC-008 / ADR-KAI-006: clasifica la salida (renuncia o despido, con reglas
 * distintas), pasa al colaborador a TERMINADO y emite `RelacionLaboralTerminada.v1` por outbox en la misma
 * transacción. Reclutamiento reacciona al evento y crea la necesidad de personal: es el único acoplamiento entre
 * ambos módulos.
 */
@Injectable()
export class TerminateEmploymentHandler {
  constructor(
    private readonly access: HrAdministrationAccessService,
    private readonly employees: EmployeeRepositoryPort,
    private readonly terminations: EmploymentTerminationRepositoryPort,
    private readonly transactionManager: TransactionManagerPort,
    private readonly clock: ClockPort,
    private readonly auditRepository: AuditEventRepositoryPort,
    private readonly outboxRepository: OutboxEventRepositoryPort,
  ) {}

  async execute(command: TerminateEmploymentCommand): Promise<TerminateEmploymentResult> {
    const found = await this.employees.findById(command.employeeId);
    if (!found) {
      throw new EmployeeNotFoundError(command.employeeId);
    }

    const { context, scope } = await this.access.authorize(
      {
        firebaseUid: command.firebaseUid,
        companyId: found.operatingCompanyId,
        branchId: found.branchId,
      },
      'TERMINATE_EMPLOYMENT',
    );

    assertTerminationRules({
      reason: command.reason,
      noticeDays: command.noticeDays,
      finalSettlementPaid: command.finalSettlementPaid,
      notes: command.notes,
    });

    return this.transactionManager.run(async (tx) => {
      const employee = await this.employees.findById(command.employeeId, tx);
      if (!employee) {
        throw new EmployeeNotFoundError(command.employeeId);
      }
      if (employee.status === 'TERMINADO') {
        throw new EmploymentAlreadyTerminatedError(employee.id);
      }

      const terminatedAt = this.clock.now();
      const notes = command.notes?.trim() || null;

      const terminatedEmployee = await this.employees.markTerminated(
        employee.id,
        {
          terminatedAt,
          terminationReason: command.reason,
          terminationNoticeDays: command.noticeDays,
          terminationNotes: notes,
        },
        tx,
      );

      const termination = await this.terminations.create(
        {
          employeeId: employee.id,
          reason: command.reason,
          noticeDays: command.noticeDays,
          finalSettlementPaid: command.finalSettlementPaid,
          settlementAmount: command.settlementAmount,
          notes,
          terminatedById: command.firebaseUid,
          terminatedAt,
        },
        tx,
      );

      await this.outboxRepository.publish(
        {
          aggregateType: 'Employee',
          aggregateId: employee.id,
          eventType: 'RelacionLaboralTerminada.v1',
          payload: {
            // 22-oct (#5): Reclutamiento crea la vacante de reemplazo al consumir este evento (`source` distingue la prueba negativa).
            source: 'HR_TERMINATION',
            candidateId: employee.candidateId ?? null,
            employeeId: employee.id,
            employeeName: employee.fullName,
            terminationId: termination.id,
            reason: command.reason,
            noticeDays: command.noticeDays,
            terminatedAt: terminatedAt.toISOString(),
            areaId: employee.areaId,
            areaName: employee.areaName,
            jobTitle: employee.jobTitle,
            actorUserId: command.firebaseUid,
            organizationId: context.organizationId,
            operatingCompanyId: scope.operatingCompanyId,
            branchId: employee.branchId,
          },
        },
        tx,
      );

      await this.auditRepository.recordHrAdministrationEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.firebaseUid,
          entityType: 'termination',
          entityId: termination.id,
          action: 'EMPLOYMENT_TERMINATED',
          changes: {
            employeeId: employee.id,
            reason: command.reason,
            noticeDays: command.noticeDays,
            finalSettlementPaid: command.finalSettlementPaid,
            settlementAmount: command.settlementAmount,
            terminatedAt: terminatedAt.toISOString(),
          },
        },
        tx,
      );

      return { termination, employee: terminatedEmployee };
    });
  }
}
