import { IsDateString, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class ConfirmSaleRefundTransferDto {
  @IsUUID()
  companyId!: string;

  @IsUUID()
  branchId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  transferVoucher!: string;

  @IsDateString()
  transferredAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
