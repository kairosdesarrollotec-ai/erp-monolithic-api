import { IsUUID } from 'class-validator';

export class ListContractTemplatesQueryDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;
}
