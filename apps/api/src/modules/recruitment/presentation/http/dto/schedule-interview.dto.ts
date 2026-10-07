import {
  IsBoolean,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class ScheduleInterviewDto {
  @IsUUID()
  companyId!: string;

  @IsUUID()
  branchId!: string;

  @IsISO8601()
  scheduledAt!: string;

  @IsBoolean()
  isVirtual!: boolean;

  @IsOptional()
  @IsString()
  meetUrl?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  interviewerId!: string;
}
