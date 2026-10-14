import { IsIn, IsOptional, IsUUID, ValidateIf } from 'class-validator';
import { HOLDER_TYPES, HolderType } from '../../../domain/contract-variant';

export class GetContractTemplateQueryDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;

  /** BR-DOC-003: persona natural o juridica. Se envia junto con withCompanyDriver. */
  @IsOptional()
  @IsIn(HOLDER_TYPES)
  holderType?: HolderType;

  /**
   * BR-DOC-003: "true" si el cliente pide que la empresa le ofrezca un conductor
   * (servicio). NO es el conductor distinto del titular de BR-ALQ-015.
   */
  @ValidateIf((o: GetContractTemplateQueryDto) => o.holderType !== undefined && o.withDriver === undefined)
  @IsIn(['true', 'false'])
  withCompanyDriver?: string;

  /** DEPRECADO (DEC-ALQ-DRIVER-001): alias de withCompanyDriver. */
  @IsOptional()
  @IsIn(['true', 'false'])
  withDriver?: string;
}
