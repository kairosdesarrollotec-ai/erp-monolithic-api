import { Injectable } from '@nestjs/common';
import { WorkContextRepositoryPort } from '../ports/work-context-repository.port';
import { GetWorkContextAssignmentsQuery } from './get-work-context-assignments.query';
import type { WorkContextAssignmentRecord } from '../ports/work-context-repository.port';

/**
 * TR-05: devuelve las empresas/sedes autorizadas para el usuario
 * autenticado. El usuario nunca elige un company_id/branch_id libremente -
 * solo ve y selecciona entre lo que esta lista ya contiene
 * (BR-ORG-002; NFR-SEC-001).
 */
@Injectable()
export class GetWorkContextAssignmentsHandler {
  constructor(private readonly repository: WorkContextRepositoryPort) {}

  async execute(query: GetWorkContextAssignmentsQuery): Promise<WorkContextAssignmentRecord[]> {
    return this.repository.findAssignmentsByFirebaseUid(query.firebaseUid);
  }
}
