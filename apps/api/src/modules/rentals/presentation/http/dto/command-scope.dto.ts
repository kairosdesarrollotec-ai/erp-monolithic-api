import { IsUUID } from 'class-validator';

export class CommandScopeDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;
}
