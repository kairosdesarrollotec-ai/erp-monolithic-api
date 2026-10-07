import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { INTERVIEWERS_MAX_LIMIT } from '../../../application/queries/list-interviewers.query';

export class ListInterviewersQueryDto {
  @IsUUID()
  companyId!: string;

  @IsUUID()
  branchId!: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(INTERVIEWERS_MAX_LIMIT)
  limit?: number;
}
