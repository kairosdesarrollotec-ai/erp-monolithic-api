import { IsUUID } from 'class-validator';

export class GetMyPermissionsQueryDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;
}
