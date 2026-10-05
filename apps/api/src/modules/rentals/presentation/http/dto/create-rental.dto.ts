import { IsDateString, IsIn, IsOptional, IsUUID } from 'class-validator';

export class CreateRentalDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;
  @IsUUID() customerId!: string;
  @IsUUID() vehicleId!: string;

  @IsOptional()
  @IsIn(['NORMAL', 'PLUS', 'LIBRE'])
  planCode?: string;

  @IsOptional()
  @IsDateString()
  startAt?: string;

  @IsOptional()
  @IsDateString()
  expectedEndAt?: string;

  @IsOptional()
  @IsUUID()
  inquiryId?: string;
}
