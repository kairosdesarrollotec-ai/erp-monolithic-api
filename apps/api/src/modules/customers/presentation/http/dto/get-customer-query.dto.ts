import { IsUUID } from 'class-validator';

export class GetCustomerQueryDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;
}
