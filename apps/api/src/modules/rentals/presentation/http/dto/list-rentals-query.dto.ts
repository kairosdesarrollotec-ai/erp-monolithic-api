import { IsDateString, IsIn, IsInt, IsOptional, IsPositive, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { RentalStatus } from '../../../domain/rental-status';

export class ListRentalsQueryDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;

  @IsOptional()
  @IsIn([
    'DRAFT',
    'VALIDATION',
    'NOTARY_EVALUATION',
    'CONTRACTING',
    'PENDING_DELIVERY',
    'ACTIVE',
    'EXTENSION_PENDING',
    'RETURN_IN_PROGRESS',
    'CLOSED',
    'CANCELLED',
  ])
  status?: RentalStatus;

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
