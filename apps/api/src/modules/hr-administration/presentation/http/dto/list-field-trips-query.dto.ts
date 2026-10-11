import { FieldTripStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';

export class ListFieldTripsQueryDto {
  @IsUUID()
  companyId!: string;

  @IsUUID()
  branchId!: string;

  @IsOptional()
  @IsEnum(FieldTripStatus)
  status?: FieldTripStatus;

  @IsOptional()
  @IsUUID()
  employeeId?: string;
}
