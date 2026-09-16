import type { WorkerRole } from '../../../domain/worker-role';

export class DashboardResponse {
  role!: WorkerRole;
  state!: 'EMPTY';
}
