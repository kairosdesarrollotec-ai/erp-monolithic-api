import { Injectable } from '@nestjs/common';
import { WorkContextAuthorizationService } from '../services/work-context-authorization.service';
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
 * Hallazgo alto de revision PR#5 ("el rol se usa para presentacion, no
 * para autorizacion" / "no usa el servicio central
 * WorkContextAuthorizationService"): este handler llamaba directamente al
 * repositorio, duplicando la politica de autorizacion que ya vive en
 * WorkContextAuthorizationService (deny-by-default, extraida en PR#4) y
 * arriesgando que TR-06 divergiera de TR-05 u otros modulos futuros. El
 * rol devuelto viene siempre de esa misma validacion (la asignacion
 * vigente resuelta por WorkContextAuthorizationService.authorize), nunca
 * de un valor enviado por el cliente ni de una segunda consulta
 * independiente al repositorio.
 *
 * PROVISIONAL: los modulos de dominio (Consulta, Reserva, Alquiler,
 * Devolucion, Reclutamiento, Administracion de Personal) todavia no
 * existen, asi que no hay tareas/alertas/borradores reales que calcular
 * todavia - se devuelve siempre `state: EMPTY` con el rol resuelto, para
 * que el frontend pueda enrutar a la vista correcta por rol sin inventar
 * datos. Cuando los modulos de dominio existan, este handler se extiende
 * para agregar tareas/alertas reales sin cambiar el contrato de entrada
 * (ver estrategia de evolucion de DashboardResponse.state en
 * packages/contracts/openapi/transversal.yaml). No declarar HU-24/TR-06
 * como funcionalidad terminada mientras esto siga asi.
 */
@Injectable()
export class GetDashboardHandler {
  constructor(private readonly authorization: WorkContextAuthorizationService) {}

  async execute(query: GetDashboardQuery): Promise<DashboardResult> {
    const context = await this.authorization.authorize({
      firebaseUid: query.firebaseUid,
      companyId: query.companyId,
      branchId: query.branchId,
    });

    return { role: context.role, state: 'EMPTY' };
  }
}
