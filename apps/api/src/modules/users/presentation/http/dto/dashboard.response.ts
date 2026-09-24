import type { WorkerRole } from '../../../domain/worker-role';

export interface DashboardTaskItem {
  id: string;
  itemType: string;
  priority: number;
  title: string;
  detail: string | null;
  deepLink: string;
}

/**
 * Extension aditiva de TR-06 (23 sep 2026, ver
 * claude/Diseno_Agregador_Transversal_TR-06-07-08.md, Project KAIROS):
 * `state: 'READY'` + `tasks` se agrega sin remover `EMPTY` ni cambiar el
 * tipo de `state`, siguiendo exactamente la estrategia de evolucion ya
 * documentada en packages/contracts/openapi/transversal.yaml
 * (DashboardResponse). Un cliente que ya trataba `state` como enum
 * cerrado sin default se rompe con este valor nuevo - ver la aclaracion
 * de compatibilidad en ese mismo YAML.
 */
export class DashboardResponse {
  role!: WorkerRole;
  state!: 'EMPTY' | 'READY';
  tasks?: DashboardTaskItem[];
}
