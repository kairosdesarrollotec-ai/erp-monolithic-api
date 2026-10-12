import { IsBoolean, IsIn, IsNumberString, IsOptional, IsString, IsUUID, ValidateIf } from 'class-validator';
import { HOLDER_TYPES, HolderType } from '../../../domain/contract-variant';

export class FormalizeContractDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;

  @IsString()
  documentRef!: string;

  @IsNumberString()
  depositAmount!: string;

  @IsIn(['PEN', 'USD'])
  depositCurrency!: string;

  /**
   * BR-DOC-003: titular natural/juridica. Junto con `withDriver` elige la
   * plantilla de contrato; si se omiten, se usa la plantilla generica.
   */
  @IsOptional()
  @IsIn(HOLDER_TYPES)
  holderType?: HolderType;

  /** BR-DOC-003: el vehiculo lo maneja un conductor distinto del titular. */
  @ValidateIf((o: FormalizeContractDto) => o.holderType !== undefined)
  @IsBoolean()
  withDriver?: boolean;

  /** Firma digital capturada como base64 PNG. Opcional. */
  @IsOptional()
  @IsString()
  signatureData?: string;
}
