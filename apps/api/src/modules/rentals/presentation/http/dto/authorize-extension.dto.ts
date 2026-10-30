import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class AuthorizeExtensionDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;

  /** Decisión 28-oct #9: el pago del periodo adicional es previo y obligatorio; se guarda su referencia (Nº de operación/comprobante) en la ampliación. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  paymentId!: string;

  @IsOptional()
  @IsString()
  addendumDocumentRef?: string;
}
