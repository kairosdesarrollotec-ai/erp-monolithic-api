import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { HOLDER_TYPES, HolderType } from '../../../domain/contract-variant';

/** DEC-ALQ-OWN-DRIVER-005: conductor propio autorizado (solo persona juridica) con la adenda que firma. */
export class RegisterAuthorizedDriverDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;

  /** Cliente que conducira (persona). */
  @IsUUID()
  driverCustomerId!: string;

  /** Referencia del documento de la adenda firmada por el conductor autorizado. */
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  addendumDocumentRef!: string;

  /** Solo si el alquiler aun no tiene contrato formalizado (si lo tiene se toma del contrato). */
  @IsOptional()
  @IsIn(HOLDER_TYPES)
  holderType?: HolderType;
}
