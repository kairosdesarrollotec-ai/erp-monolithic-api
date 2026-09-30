import { IsUUID } from 'class-validator';

export class GetOrganizationCompaniesDto {
  @IsUUID()
  companyId!: string;

  @IsUUID()
  branchId!: string;
}
