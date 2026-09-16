import { IsString, IsNotEmpty } from 'class-validator';

export class GetDashboardDto {
  @IsString()
  @IsNotEmpty()
  companyId!: string;

  @IsString()
  @IsNotEmpty()
  branchId!: string;
}
