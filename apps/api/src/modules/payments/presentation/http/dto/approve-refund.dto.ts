import { IsUUID, IsOptional, IsString, MaxLength } from 'class-validator';

export class ApproveRefundDto {
  @IsUUID()
  companyId!: string;

  @IsUUID()
  branchId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
