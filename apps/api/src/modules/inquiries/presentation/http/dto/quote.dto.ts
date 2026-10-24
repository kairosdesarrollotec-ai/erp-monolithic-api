import { IsIn, IsInt, IsNotEmpty, IsOptional, IsPositive, IsString, IsUUID } from 'class-validator';

export class QuoteDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;

  @IsUUID() vehicleId!: string;
  @IsString() @IsNotEmpty() destination!: string;

  @IsInt() @IsPositive() estimatedDays!: number;

  @IsOptional()
  @IsIn(['NORMAL', 'PLUS', 'LIBRE'])
  plan?: 'NORMAL' | 'PLUS' | 'LIBRE';
}
