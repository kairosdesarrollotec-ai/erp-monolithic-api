import { IsUUID } from 'class-validator';

export class GetVehicleQueryDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;
}
