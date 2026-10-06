import { IsDateString, IsIn, IsInt, IsOptional, IsPositive, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { RETURN_STATUSES, ReturnStatus } from '../../../domain/return-status';

export class ListReturnsQueryDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;

  @IsOptional()
  @IsIn(RETURN_STATUSES)
  status?: ReturnStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  limit?: number;

  @IsOptional()
  @IsDateString()
  cursorCreatedAt?: string;

  @IsOptional()
  @IsUUID()
  cursorId?: string;
}
