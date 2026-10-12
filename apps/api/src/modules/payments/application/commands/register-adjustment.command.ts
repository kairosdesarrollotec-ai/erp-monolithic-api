import type { AdjustmentType } from '../../domain/adjustment-type';

export class RegisterAdjustmentCommand {
  constructor(
    readonly depositId: string,
    readonly firebaseUid: string,
    readonly companyId: string,
    readonly branchId: string,
    readonly type: AdjustmentType,
    readonly amount: number,
    readonly reason: string,
  ) {}
}
