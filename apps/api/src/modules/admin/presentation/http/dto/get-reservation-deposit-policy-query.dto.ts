import { IsUUID } from 'class-validator';

export class GetReservationDepositPolicyQueryDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;
}
