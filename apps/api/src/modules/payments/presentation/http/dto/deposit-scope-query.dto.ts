import { IsUUID } from 'class-validator';

export class DepositScopeQueryDto {
  @IsUUID()
  companyId!: string;

  @IsUUID()
  branchId!: string;
}
