import { IsEnum, IsInt, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';
import { VacationStatus } from '@prisma/client';

export class ResolveVacationDto {
  @IsEnum(VacationStatus)
  status!: VacationStatus;

  @IsOptional()
  @IsInt()
  @IsPositive()
  grantedDays?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  statusReason?: string;
}
