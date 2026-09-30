import { IsIn, IsNumberString, IsString, IsUUID } from 'class-validator';

export class FormalizeContractDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;

  @IsUUID()
  templateVersionId!: string;

  @IsString()
  documentRef!: string;

  @IsNumberString()
  depositAmount!: string;

  @IsIn(['PEN', 'USD'])
  depositCurrency!: string;
}
