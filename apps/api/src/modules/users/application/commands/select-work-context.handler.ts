import { ForbiddenException, Injectable } from '@nestjs/common';
import { WorkContextRepositoryPort } from '../ports/work-context-repository.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { SelectWorkContextCommand } from './select-work-context.command';

/**
 * TR-05: fija el contexto de trabajo (empresa/sede) con el que el usuario
 * continua hacia TR-06. Punto 8 del contrato (BR-ORG-002; NFR-SEC-001):
 * el company_id/branch_id que llega del cliente se valida siempre contra
 * las asignaciones reales antes de aceptarlo - nunca se confia en el
 * payload por si solo. Punto 11: la seleccion queda registrada como
 * evento auditable.
 */
@Injectable()
export class SelectWorkContextHandler {
  constructor(
    private readonly workContextRepository: WorkContextRepositoryPort,
    private readonly auditRepository: AuditEventRepositoryPort,
  ) {}

  async execute(command: SelectWorkContextCommand): Promise<void> {
    const assignment = await this.workContextRepository.findValidAssignment({
      firebaseUid: command.firebaseUid,
      companyId: command.companyId,
      branchId: command.branchId,
    });

    if (!assignment) {
      throw new ForbiddenException(
        'La combinacion de empresa/sede no es una asignacion vigente para este usuario.',
      );
    }

    await this.auditRepository.recordWorkContextSelection({
      organizationId: assignment.organizationId,
      firebaseUid: command.firebaseUid,
      companyId: command.companyId,
      branchId: command.branchId,
    });
  }
}
