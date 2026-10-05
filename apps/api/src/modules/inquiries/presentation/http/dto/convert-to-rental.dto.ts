import { IsIn, IsOptional, IsUUID } from 'class-validator';

/** Plan (DAT-ALQ-001): mismo catalogo que `POST /rentals`. Opcional, por defecto NORMAL. */
export class ConvertToRentalDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;

  @IsOptional()
  @IsIn(['NORMAL', 'PLUS', 'LIBRE'])
  planCode?: string;
}
