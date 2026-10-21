import { IsUUID } from 'class-validator';

export class ListHrAreasQueryDto {
  @IsUUID()
  companyId!: string;

  @IsUUID()
  branchId!: string;
}
