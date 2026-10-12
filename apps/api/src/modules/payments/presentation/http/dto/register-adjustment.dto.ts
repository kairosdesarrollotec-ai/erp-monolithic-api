import { IsUUID, IsIn, IsNumber, Min, IsString, MinLength, MaxLength } from 'class-validator';
import type { AdjustmentType } from '../../../domain/adjustment-type';

export class RegisterAdjustmentDto {
  @IsUUID()
  companyId!: string;

  @IsUUID()
  branchId!: string;

  @IsIn(['DISCOUNT', 'FULL_RETENTION', 'RELEASE', 'IMMOBILIZATION_CHARGE'])
  type!: AdjustmentType;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason!: string;
}
