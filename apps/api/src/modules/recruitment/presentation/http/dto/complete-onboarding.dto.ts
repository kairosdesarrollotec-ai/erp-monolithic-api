import { IsBoolean, IsDateString, IsOptional, IsUUID } from 'class-validator';

export class CompleteOnboardingDto {
  @IsUUID()
  companyId!: string;

  @IsUUID()
  branchId!: string;

  @IsDateString()
  startDate!: string;

  @IsBoolean()
  inductionScheduled!: boolean;

  @IsBoolean()
  equipmentAssigned!: boolean;

  @IsBoolean()
  responsibilityCardSigned!: boolean;

  @IsOptional()
  @IsBoolean()
  notarizedContractSigned?: boolean;
}
