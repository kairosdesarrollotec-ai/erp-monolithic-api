import { IsUUID } from 'class-validator';

export class GetOrganizationUsersDto {
  @IsUUID()
  companyId!: string;

  @IsUUID()
  branchId!: string;
}
