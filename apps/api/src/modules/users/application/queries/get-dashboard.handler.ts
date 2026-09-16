import { ForbiddenException, Injectable } from '@nestjs/common';
import { WorkContextRepositoryPort } from '../ports/work-context-repository.port';
import { GetDashboardQuery } from './get-dashboard.query';
import type { WorkerRole } from '../../domain/worker-role';

export interface DashboardResult {
  role: WorkerRole;
  state: 'EMPTY';
}

/**
 * TR-06 (HU-24): punto de entrada del tablero por rol. Igual que TR-05
 * (BR-ORG-002; NFR-SEC-001), el companyId/branchId que llega del cliente
 * se valida siempre contra una asignacion real antes de usarlo - nunca se
 * confia en el rol que el cliente diga tener.
 *
 * PROVISIONAL: los modulos de dominio (Consulta, Reserva, Alquiler,
 * Devolucion, Reclutamiento, Administracion de Personal) todavia no
 * existen, asi que no hay tareas/alertas/borradores reales que calcular
 * todavia - se devuelve siempre `state: EMPTY` con el rol resuelto, para
 * que el frontend pueda enrutar a la vista correcta por rol sin inventar
 * datos. Cuando los modulos de dominio existan, este handler se extiende
 * para agregar tareas/alertas reales sin cambiar el contrato de entrada.
 */
@Injectable()
export class GetDashboardHandler {
  constructor(private readonly workContextRepository: WorkContextRepositoryPort) {}

  async execute(query: GetDashboardQuery): Promise<DashboardResult> {
    const assignment = await this.workContextRepository.findValidAssignment({
      firebaseUid: query.firebaseUid,
      companyId: query.companyId,
      branchId: query.branchId,
    });

    if (!assignment) {
      throw new ForbiddenException(
        'La combinacion de empresa/sede no es una asignacion vigente para este usuario.',
      );
    }

    return { role: assignment.role, state: 'EMPTY' };
  }
}
