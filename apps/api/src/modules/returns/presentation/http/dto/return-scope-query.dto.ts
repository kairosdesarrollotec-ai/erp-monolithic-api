import { IsUUID } from 'class-validator';

export class ReturnScopeQueryDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;
}
