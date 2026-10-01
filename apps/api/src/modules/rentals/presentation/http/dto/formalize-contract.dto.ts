import { IsIn, IsNumberString, IsOptional, IsString, IsUUID } from 'class-validator';

export class FormalizeContractDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;

  /** Opcional: si se omite, el backend resuelve la plantilla ACTIVE vigente de la empresa (BR-DOC-002). */
  @IsOptional()
  @IsUUID()
  templateVersionId?: string;

  @IsString()
  documentRef!: string;

  @IsNumberString()
  depositAmount!: string;

  @IsIn(['PEN', 'USD'])
  depositCurrency!: string;
}
