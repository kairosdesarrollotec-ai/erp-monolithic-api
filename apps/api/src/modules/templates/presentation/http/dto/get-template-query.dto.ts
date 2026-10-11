import { IsUUID } from 'class-validator';

export class GetTemplateQueryDto {
  @IsUUID()
  companyId!: string;

  @IsUUID()
  branchId!: string;
}
