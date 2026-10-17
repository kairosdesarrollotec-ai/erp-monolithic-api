import { IsBoolean, IsIn, IsNumberString, IsOptional, IsString, IsUUID, ValidateIf } from 'class-validator';
import { HOLDER_TYPES, HolderType } from '../../../domain/contract-variant';

export class FormalizeContractDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;

  @IsString()
  documentRef!: string;

  /**
   * Garantia. OBLIGATORIA salvo con conductor de la empresa (`withCompanyDriver=true`): ahi NO se exige ni se cobra
   * (DEC-ALQ-COMPANY-DRIVER-004) y enviarla > 0 responde 422 DEPOSIT_NOT_APPLICABLE_WITH_COMPANY_DRIVER.
   */
  @ValidateIf((o: FormalizeContractDto) => !(o.withCompanyDriver === true || o.withDriver === true))
  @IsNumberString()
  depositAmount?: string;

  @ValidateIf((o: FormalizeContractDto) => !(o.withCompanyDriver === true || o.withDriver === true))
  @IsIn(['PEN', 'USD'])
  depositCurrency?: string;

  /**
   * BR-DOC-003: titular natural/juridica. Junto con `withCompanyDriver` elige la
   * plantilla de contrato; si se omiten, se usa la plantilla generica.
   */
  @IsOptional()
  @IsIn(HOLDER_TYPES)
  holderType?: HolderType;

  /**
   * BR-DOC-003: el cliente pide que la empresa le ofrezca un conductor
   * (servicio de conductor). NO es el conductor distinto del titular de
   * BR-ALQ-015 (otra persona que maneja un alquiler sin aprobacion previa).
   */
  @ValidateIf((o: FormalizeContractDto) => o.holderType !== undefined && o.withDriver === undefined)
  @IsBoolean()
  withCompanyDriver?: boolean;

  /** DEPRECADO (DEC-ALQ-DRIVER-001): alias de withCompanyDriver. */
  @IsOptional()
  @IsBoolean()
  withDriver?: boolean;

  /** Firma digital capturada como base64 PNG. Opcional. */
  @IsOptional()
  @IsString()
  signatureData?: string;
}
