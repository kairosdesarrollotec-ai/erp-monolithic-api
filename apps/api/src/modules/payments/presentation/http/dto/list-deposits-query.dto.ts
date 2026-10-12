import { IsUUID, IsOptional, IsIn, IsInt, Min, Max, IsISO8601 } from 'class-validator';
import { Type } from 'class-transformer';
import type { DepositStatus } from '../../../domain/deposit-status';

export class ListDepositsQueryDto {
  @IsUUID()
  companyId!: string;

  @IsUUID()
  branchId!: string;

  @IsOptional()
  @IsIn(['HELD', 'RETURNED', 'RETAINED', 'PARTIALLY_RETAINED'])
  status?: DepositStatus;

  @IsOptional()
  @IsUUID()
  rentalId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsISO8601()
  cursorCreatedAt?: string;

  @IsOptional()
  @IsUUID()
  cursorId?: string;
}
