import { IsUUID } from 'class-validator';

export class MyEmployeeQueryDto {
  @IsUUID()
  companyId!: string;

  @IsUUID()
  branchId!: string;
}
