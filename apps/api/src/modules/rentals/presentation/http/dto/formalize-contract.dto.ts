import { IsIn, IsNumberString, IsOptional, IsString, IsUUID } from 'class-validator';

export class FormalizeContractDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;

  @IsString()
  documentRef!: string;

  @IsNumberString()
  depositAmount!: string;

  @IsIn(['PEN', 'USD'])
  depositCurrency!: string;

  /** Firma digital capturada como base64 PNG. Opcional. */
  @IsOptional()
  @IsString()
  signatureData?: string;
}
