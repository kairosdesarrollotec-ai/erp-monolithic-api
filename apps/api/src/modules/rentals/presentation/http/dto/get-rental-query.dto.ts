import { IsUUID } from 'class-validator';

export class GetRentalQueryDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;
}
