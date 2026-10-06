import type { WorkerRole } from '../../../users/domain/worker-role';

export interface SaveRolePermissionMatrixEntryInput {
  role: WorkerRole;
  module: 'RESERVATION' | 'INQUIRY' | 'ADMIN' | 'RENTAL' | 'INCIDENT';
  action: string;
  allowed: boolean;
}

export class SaveRolePermissionMatrixCommand {
  constructor(
    public readonly actorFirebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly entries: SaveRolePermissionMatrixEntryInput[],
  ) {}
}
