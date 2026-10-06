import { IsDateString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class ScheduleReturnDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;
  @IsUUID() rentalId!: string;

  @IsDateString()
  scheduledAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
