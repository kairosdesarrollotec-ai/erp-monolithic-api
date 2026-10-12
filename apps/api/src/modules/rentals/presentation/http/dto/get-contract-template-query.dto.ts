import { IsIn, IsOptional, IsUUID, ValidateIf } from 'class-validator';
import { HOLDER_TYPES, HolderType } from '../../../domain/contract-variant';

export class GetContractTemplateQueryDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;

  /** BR-DOC-003: persona natural o juridica. Se envia junto con withDriver. */
  @IsOptional()
  @IsIn(HOLDER_TYPES)
  holderType?: HolderType;

  /** BR-DOC-003: "true" si el vehiculo lo maneja un conductor distinto del titular. */
  @ValidateIf((o: GetContractTemplateQueryDto) => o.holderType !== undefined)
  @IsIn(['true', 'false'])
  withDriver?: string;
}
